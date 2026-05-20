/* eslint-env node */

var fs = require("fs");

var currentLayout = 0;
var currentMode = 0;
var currentBase = 48;
var currentKeysPerOctave = 11;
var sentEvents = [];

global.GetParameter = function (index) {
  if (index === 0) return currentBase;
  if (index === 1) return currentLayout;
  if (index === 2) return currentMode;
  if (index === 3) return currentKeysPerOctave;
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

function primeLayoutState(layout) {
  if (layout === LAYOUT_WHITE_UTIL_DIR || layout === LAYOUT_WHITE_UTIL_DIR_INV) {
    rememberNoteOn(currentBase);
    rememberNoteOn(currentBase + 2);
  }

  if (layout === LAYOUT_WHITE_UTIL_LEAST || layout === LAYOUT_WHITE_UTIL_LEAST_INV) {
    recordWhiteNote(currentBase);
    recordWhiteNote(currentBase + 2);
    recordWhiteNote(currentBase + 4);
    recordWhiteNote(currentBase + 5);
  }
}

function primaryLayoutForPair(layout, mode) {
  return layoutForPair(layout, mode, 12);
}

function extendedLayoutForPair(layout, mode) {
  return layoutForPair(layout, mode, EXTENDED_KEY_COUNT);
}

function layoutForPair(layout, mode, count) {
  currentLayout = layout;
  currentMode = mode;
  resetState();
  primeLayoutState(layout);
  Math.random = function () {
    return deterministicRandomForMode(mode);
  };

  var cells = [];
  for (var i = 0; i < count; i++) {
    var note = currentBase + i;
    var cents = centsFromPitchMap(mapPitch(note, directionFromRecentNotes(note)));
    cells.push(centsLabel(cents));
  }
  return cells;
}

function voicesForPair(layout, mode, note) {
  currentLayout = layout;
  currentMode = mode;
  resetState();
  primeLayoutState(layout);
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

  return [primaryLayoutForPair(layout, mode)[note - currentBase]];
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

function pairReport(layout, mode) {
  var keyLayout = primaryLayoutForPair(layout, mode);
  var extendedLayout = extendedLayoutForPair(layout, mode);
  return {
    layout: layout,
    mode: mode,
    layoutName: LAYOUT_NAMES[layout],
    name: MODE_NAMES[mode],
    keyLayout: keyLayout,
    repeats: repeatedRuns(keyLayout),
    extendedRepeats: repeatedRuns(extendedLayout),
    voices: voicesForPair(layout, mode, currentBase)
  };
}

function markdownReport() {
  currentKeysPerOctave = 11;
  var lines = [];
  lines.push("# Elevenator Mode Layouts");
  lines.push("");
  lines.push("Generated from `Elevenator.js` with `Base Note = 48` and `Keys Per Octave = 11`.");
  lines.push("");
  lines.push("- `s0` is the base pitch.");
  lines.push("- `s11` is the octave above the base.");
  lines.push("- C..B shows twelve traditional physical keys so duplicate/reset behavior is visible.");
  lines.push("- Extended repeat checks scan " + EXTENDED_KEY_COUNT + " physical keys, so B -> next C boundary problems are visible.");
  lines.push("- Multi-note modes list the primary root layout, then voices produced by C.");
  lines.push("- Direction layouts are primed with ascending C -> D motion.");
  lines.push("- Random modes use deterministic midpoint randomness.");
  lines.push("");
  lines.push("| Layout | Mode | C | C# | D | D# | E | F | F# | G | G# | A | A# | B | Adjacent repeats | C voices |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");

  for (var layout = 0; layout < LAYOUT_NAMES.length; layout++) {
    for (var mode = 0; mode < MODE_NAMES.length; mode++) {
      var report = pairReport(layout, mode);
      var repeats = report.repeats.map(function (run) {
        return run.from + "-" + run.to + " x" + run.count + " " + run.value;
      }).join("<br>");
      if (!repeats) repeats = "";
      lines.push("| " + report.layoutName + " | " + report.name + " | " + report.keyLayout.join(" | ") + " | " + repeats + " | " + report.voices.join("<br>") + " |");
    }
  }

  lines.push("");
  lines.push("## Checks");
  lines.push("");
  var allLongRuns = allExtendedRuns(3);
  lines.push("- Layout/mode pairs with adjacent runs >= 3 over " + EXTENDED_KEY_COUNT + " keys: `" + allLongRuns.length + "`.");
  if (allLongRuns.length > 0) {
    lines.push("- Long-run patterns: " + allLongRuns.map(function (run) {
      return run.mode + " " + run.from + "-" + run.to + " x" + run.count + " " + run.value;
    }).join("; "));
  }
  lines.push("- Ratio sanity checks: `" + ratioFailures().length + "` failures.");
  lines.push("- Note-off balance checks: `" + noteOffFailures().length + "` failures.");
  lines.push("- `node test-layouts.js --check` fails if any layout/mode pair has 3 or more adjacent same-pitch keys.");
  lines.push("- White Traditional uses 12-key physical white/black geometry.");
  lines.push("- White Util modes use the compact 11-key utility spine.");
  return lines.join("\n") + "\n";
}

function ratioFailures() {
  var failures = [];
  var previousMode = currentMode;
  var previousLayout = currentLayout;
  var previousKeysPerOctave = currentKeysPerOctave;
  currentLayout = LAYOUT_CHROMATIC;
  currentMode = MODE_PLAIN;

  var ratios = [11, 12, 13];
  for (var i = 0; i < ratios.length; i++) {
    currentKeysPerOctave = ratios[i];
    resetState();
    var cents = centsFromPitchMap(mapPitch(currentBase + ratios[i]));
    var centsAboveBase = Math.round((cents - currentBase * 100) * 1000) / 1000;
    if (centsAboveBase !== 1200) {
      failures.push("ratio " + ratios[i] + " maps key +" + ratios[i] + " to " + centsAboveBase + "c");
    }
  }

  currentMode = previousMode;
  currentLayout = previousLayout;
  currentKeysPerOctave = previousKeysPerOctave;
  return failures;
}

function allExtendedRuns(minCount) {
  var runs = [];
  for (var layout = 0; layout < LAYOUT_NAMES.length; layout++) {
    for (var mode = 0; mode < MODE_NAMES.length; mode++) {
      var report = pairReport(layout, mode);
      for (var i = 0; i < report.extendedRepeats.length; i++) {
        if (report.extendedRepeats[i].count >= minCount) {
          runs.push({
            layout: report.layoutName,
            mode: report.name,
            from: report.extendedRepeats[i].from,
            to: report.extendedRepeats[i].to,
            count: report.extendedRepeats[i].count,
            value: report.extendedRepeats[i].value
          });
        }
      }
    }
  }
  return runs;
}

function noteOffFailures() {
  var failures = [];
  var previousLayout = currentLayout;
  var previousMode = currentMode;

  for (var layout = 0; layout < LAYOUT_NAMES.length; layout++) {
    for (var mode = 0; mode < MODE_NAMES.length; mode++) {
      currentLayout = layout;
      currentMode = mode;
      resetState();
      primeLayoutState(layout);
      Math.random = function () {
        return deterministicRandomForMode(mode);
      };

      var noteOn = new NoteOn();
      noteOn.pitch = currentBase;
      noteOn.velocity = 100;
      noteOn.channel = 1;
      HandleMIDI(noteOn);

      var noteOff = new NoteOff();
      noteOff.pitch = currentBase;
      noteOff.velocity = 0;
      noteOff.channel = 1;
      HandleMIDI(noteOff);

      var balance = {};
      for (var i = 0; i < sentEvents.length; i++) {
        var key = sentEvents[i].pitch;
        if (!balance.hasOwnProperty(key)) {
          balance[key] = 0;
        }
        if (sentEvents[i].type === "on") {
          balance[key] += 1;
        } else if (sentEvents[i].type === "off") {
          balance[key] -= 1;
        }
      }

      for (var pitch in balance) {
        if (balance.hasOwnProperty(pitch) && balance[pitch] !== 0) {
          failures.push(LAYOUT_NAMES[layout] + " / " + MODE_NAMES[mode] + " leaves pitch " + pitch + " balance " + balance[pitch]);
        }
      }
    }
  }

  currentLayout = previousLayout;
  currentMode = previousMode;
  return failures;
}

if (process.argv.indexOf("--markdown") !== -1) {
  process.stdout.write(markdownReport());
} else if (process.argv.indexOf("--check") !== -1) {
  var failures = [];
  currentKeysPerOctave = 11;
  var longRuns = allExtendedRuns(3);
  var ratioProblems = ratioFailures();
  var noteOffProblems = noteOffFailures();

  if (longRuns.length > 0) {
    failures.push("Layout/mode pairs have adjacent repeated pitch runs >= 3: " + longRuns.map(function (run) {
      return run.layout + " / " + run.mode + " " + run.from + "-" + run.to + " " + run.value;
    }).join(", "));
  }

  if (ratioProblems.length > 0) {
    failures.push("Ratio checks failed: " + ratioProblems.join(", "));
  }

  if (noteOffProblems.length > 0) {
    failures.push("Note-off balance failed: " + noteOffProblems.join(", "));
  }

  if (failures.length > 0) {
    for (var f = 0; f < failures.length; f++) {
      console.error(failures[f]);
    }
    process.exit(1);
  }

  console.log("layout checks passed");
} else {
  for (var layout = 0; layout < LAYOUT_NAMES.length; layout++) {
    for (var mode = 0; mode < MODE_NAMES.length; mode++) {
      var report = pairReport(layout, mode);
      console.log(report.layoutName + " / " + report.name);
      console.log("  " + KEY_LABELS_12.join(" | "));
      console.log("  " + report.keyLayout.join(" | "));
      if (report.repeats.length > 0) {
        console.log("  repeats: " + report.repeats.map(function (run) {
          return run.from + "-" + run.to + " x" + run.count + " " + run.value;
        }).join(", "));
      }
      console.log("  C voices: " + report.voices.join(", "));
    }
  }
}
