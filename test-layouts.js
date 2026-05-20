/* eslint-env node */

var fs = require("fs");

var currentMode = 0;
var currentBase = 48;
var sentEvents = [];

global.GetParameter = function (index) {
  if (index === 0) return currentBase;
  if (index === 1) return currentMode;
  return 0;
};

global.NoteOn = function () {
  this.pitch = 60;
  this.velocity = 100;
  this.channel = 1;
};

global.NoteOn.prototype.send = function () {
  sentEvents.push({
    type: "on",
    pitch: this.pitch,
    detune: this.detune || 0,
    velocity: this.velocity,
    delay: 0
  });
};

global.NoteOn.prototype.sendAfterBeats = function (delay) {
  sentEvents.push({
    type: "on",
    pitch: this.pitch,
    detune: this.detune || 0,
    velocity: this.velocity,
    delay: delay
  });
};

global.NoteOff = function () {
  this.pitch = 60;
  this.velocity = 0;
  this.channel = 1;
};

global.NoteOff.prototype.send = function () {
  sentEvents.push({
    type: "off",
    pitch: this.pitch,
    detune: 0,
    velocity: this.velocity,
    delay: 0
  });
};

global.NoteOff.prototype.sendAfterBeats = function (delay) {
  sentEvents.push({
    type: "off",
    pitch: this.pitch,
    detune: 0,
    velocity: this.velocity,
    delay: delay
  });
};

eval(fs.readFileSync("Elevenator.js", "utf8"));

var KEY_LABELS_12 = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var EXTENDED_KEY_COUNT = 25;

function resetState() {
  sentEvents = [];
  whiteCounts = [0, 0, 0, 0, 0, 0, 0];
  whiteBuffer = [];
  lastBaseNote = null;
  lastNoteOn = null;
  recentNoteOns = [];
  activeMap = {};
  chordActiveMap = {};
  leastStepCounter = 0;
  mirrorToggle = 0;
}

function centsFromPitchMap(pitchMap) {
  var mapped = normalizePitchMap(pitchMap);
  if (mapped === null) return null;
  return mapped.pitch * 100 + (mapped.detune || 0);
}

function stepFromCents(cents) {
  if (cents === null) return "drop";
  return Math.round((cents - currentBase * 100) / (1200 / 11));
}

function centsLabel(cents) {
  if (cents === null) return "drop";
  var step = stepFromCents(cents);
  var rounded = Math.round((cents - currentBase * 100) * 1000) / 1000;
  return "s" + step + " (" + rounded + "c)";
}

function deterministicRandomForMode(mode) {
  if (mode === MODE_DRUNK) return 0.5;
  if (mode === MODE_CHANCE_COMPANION) return 0.5;
  return 0.5;
}

function primeModeState(mode) {
  if (mode === MODE_WHITE_UTIL_DIR || mode === MODE_WHITE_UTIL_DIR_INV) {
    rememberNoteOn(currentBase);
    rememberNoteOn(currentBase + 2);
  }

  if (mode === MODE_WHITE_UTIL_LEAST || mode === MODE_WHITE_UTIL_LEAST_INV) {
    recordWhiteNote(currentBase);
    recordWhiteNote(currentBase + 2);
    recordWhiteNote(currentBase + 4);
    recordWhiteNote(currentBase + 5);
  }
}

function primaryLayoutForMode(mode) {
  return layoutForMode(mode, 12);
}

function extendedLayoutForMode(mode) {
  return layoutForMode(mode, EXTENDED_KEY_COUNT);
}

function layoutForMode(mode, count) {
  currentMode = mode;
  resetState();
  primeModeState(mode);
  Math.random = function () {
    return deterministicRandomForMode(mode);
  };

  var cells = [];
  for (var i = 0; i < count; i++) {
    var note = currentBase + i;
    var cents;
    if (isMultiNoteMode(mode)) {
      var intervals = chordIntervalsForMode(mode);
      if (intervals && intervals.length > 0) {
        cents = centsFromPitchMap(elevenPitchMapForStepOffset(note, intervals[0]));
      } else {
        cents = centsFromPitchMap(mapElevenator(note));
      }
    } else if (mode === MODE_WHITE_UTIL_DIR || mode === MODE_WHITE_UTIL_DIR_INV) {
      cents = centsFromPitchMap(mapPitchWithDirection(note, directionFromRecentNotes(note)));
    } else {
      cents = centsFromPitchMap(mapPitch(note));
    }
    cells.push(centsLabel(cents));
  }
  return cells;
}

function voicesForMode(mode, note) {
  currentMode = mode;
  resetState();
  Math.random = function () {
    return 0.5;
  };

  if (isMultiNoteMode(mode)) {
    var event = new NoteOn();
    event.pitch = note;
    event.velocity = 100;
    event.channel = 1;
    HandleMIDI(event);
    return sentEvents
      .filter(function (entry) { return entry.type === "on"; })
      .map(function (entry) {
        return centsLabel(entry.pitch * 100 + entry.detune) + (entry.delay ? " @" + entry.delay + "b" : "");
      });
  }

  return [primaryLayoutForMode(mode)[note - currentBase]];
}

function repeatedRuns(layout) {
  var runs = [];
  var start = 0;
  for (var i = 1; i <= layout.length; i++) {
    if (i === layout.length || layout[i] !== layout[start]) {
      if (i - start > 1) {
        runs.push({
          from: keyLabel(start),
          to: keyLabel(i - 1),
          count: i - start,
          value: layout[start]
        });
      }
      start = i;
    }
  }
  return runs;
}

function keyLabel(index) {
  var octave = Math.floor(index / 12);
  var label = KEY_LABELS_12[index % 12];
  if (octave === 0) return label;
  return label + "+" + octave;
}

function modeReport(mode) {
  var layout = primaryLayoutForMode(mode);
  var extendedLayout = extendedLayoutForMode(mode);
  return {
    mode: mode,
    name: MODE_NAMES[mode],
    layout: layout,
    repeats: repeatedRuns(layout),
    extendedRepeats: repeatedRuns(extendedLayout),
    voices: voicesForMode(mode, currentBase)
  };
}

function markdownReport() {
  var lines = [];
  lines.push("# Elevenator Mode Layouts");
  lines.push("");
  lines.push("Generated from `Elevenator.js` with `Base Note = 48`.");
  lines.push("");
  lines.push("- `s0` is the base pitch.");
  lines.push("- `s11` is the octave above the base.");
  lines.push("- C..B shows twelve traditional physical keys so duplicate/reset behavior is visible.");
  lines.push("- Extended repeat checks scan " + EXTENDED_KEY_COUNT + " physical keys, so B -> next C boundary problems are visible.");
  lines.push("- Multi-note modes list the primary root layout, then voices produced by C.");
  lines.push("- Direction mode is primed with ascending C -> D motion.");
  lines.push("- Random modes use deterministic midpoint randomness.");
  lines.push("");
  lines.push("| # | Mode | C | C# | D | D# | E | F | F# | G | G# | A | A# | B | Adjacent repeats | C voices |");
  lines.push("|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");

  for (var mode = 0; mode < MODE_NAMES.length; mode++) {
    var report = modeReport(mode);
    var repeats = report.repeats.map(function (run) {
      return run.from + "-" + run.to + " x" + run.count + " " + run.value;
    }).join("<br>");
    if (!repeats) repeats = "";
    lines.push("| " + report.mode + " | " + report.name + " | " + report.layout.join(" | ") + " | " + repeats + " | " + report.voices.join("<br>") + " |");
  }

  lines.push("");
  lines.push("## Checks");
  lines.push("");
  var allLongRuns = allExtendedRuns(3);
  lines.push("- Static modes with adjacent runs >= 3 over " + EXTENDED_KEY_COUNT + " keys: `" + allLongRuns.length + "`.");
  if (allLongRuns.length > 0) {
    lines.push("- Long-run patterns: " + allLongRuns.map(function (run) {
      return run.mode + " " + run.from + "-" + run.to + " x" + run.count + " " + run.value;
    }).join("; "));
  }
  lines.push("- `node test-layouts.js --check` fails if any static mode has 3 or more adjacent same-pitch keys.");
  lines.push("- White Traditional uses 12-key physical white/black geometry.");
  lines.push("- White Util modes use the compact 11-key utility spine.");
  return lines.join("\n") + "\n";
}

function allExtendedRuns(minCount) {
  var runs = [];
  for (var mode = 0; mode < MODE_NAMES.length; mode++) {
    var report = modeReport(mode);
    for (var i = 0; i < report.extendedRepeats.length; i++) {
      if (report.extendedRepeats[i].count >= minCount) {
        runs.push({
          mode: report.name,
          from: report.extendedRepeats[i].from,
          to: report.extendedRepeats[i].to,
          count: report.extendedRepeats[i].count,
          value: report.extendedRepeats[i].value
        });
      }
    }
  }
  return runs;
}

if (process.argv.indexOf("--markdown") !== -1) {
  process.stdout.write(markdownReport());
} else if (process.argv.indexOf("--check") !== -1) {
  var failures = [];
  var longRuns = allExtendedRuns(3);

  if (longRuns.length > 0) {
    failures.push("Static modes have adjacent repeated pitch runs >= 3: " + longRuns.map(function (run) {
      return run.mode + " " + run.from + "-" + run.to + " " + run.value;
    }).join(", "));
  }

  if (failures.length > 0) {
    for (var f = 0; f < failures.length; f++) {
      console.error(failures[f]);
    }
    process.exit(1);
  }

  console.log("layout checks passed");
} else {
  for (var mode = 0; mode < MODE_NAMES.length; mode++) {
    var report = modeReport(mode);
    console.log(mode + ": " + report.name);
    console.log("  " + KEY_LABELS_12.join(" | "));
    console.log("  " + report.layout.join(" | "));
    if (report.repeats.length > 0) {
      console.log("  repeats: " + report.repeats.map(function (run) {
        return run.from + "-" + run.to + " x" + run.count + " " + run.value;
      }).join(", "));
    }
    console.log("  C voices: " + report.voices.join(", "));
  }
}
