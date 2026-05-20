// Logic Pro Scripter: Elevenator (tunable physical keys per octave)

var PARAM_BASE_NOTE = 0;
var PARAM_LAYOUT = 1;
var PARAM_MODE = 2;
var PARAM_KEYS_PER_OCTAVE = 3;

var LAYOUT_NAMES = [
  "Chromatic Ratio",
  "White Traditional: Safe",
  "White Util: Down",
  "White Util: Up",
  "White Util: Zigzag",
  "White Util: Thirds",
  "White Util: Fifths",
  "White Util: Mirror",
  "White Util: Octave Up",
  "White Util: Direction",
  "White Util: Direction Invert",
  "White Util: Least Used",
  "White Util: Least Used Invert"
];

var MODE_NAMES = [
  "Plain",
  "Reverse",
  "Invert",
  "Negative Harmony",
  "Whole Tone Ladder",
  "Pentatonic Climb",
  "Drunk Pianist",
  "Mirror Trick",
  "Chord: Major",
  "Chord: Minor",
  "Chord: Power 5",
  "Chord: Sus4",
  "Chord: Maj7",
  "Chord: Min7",
  "Chord: Quartal",
  "Chord: Big Hands",
  "Octave Spray",
  "Strum: Major Up",
  "Echo: 1/8 Cascade",
  "Chord: Dominant #9",
  "Chord: Crunch Cluster",
  "Strum: Eleven Fan",
  "Echo: Spiral 11",
  "Chaos: Chance Companion"
];

var LAYOUT_CHROMATIC = 0;
var LAYOUT_WHITE_TRAD_SAFE = 1;
var LAYOUT_WHITE_UTIL_DOWN = 2;
var LAYOUT_WHITE_UTIL_UP = 3;
var LAYOUT_WHITE_UTIL_ZIGZAG = 4;
var LAYOUT_WHITE_UTIL_THIRDS = 5;
var LAYOUT_WHITE_UTIL_FIFTHS = 6;
var LAYOUT_WHITE_UTIL_MIRROR = 7;
var LAYOUT_WHITE_UTIL_OCTAVE_UP = 8;
var LAYOUT_WHITE_UTIL_DIR = 9;
var LAYOUT_WHITE_UTIL_DIR_INV = 10;
var LAYOUT_WHITE_UTIL_LEAST = 11;
var LAYOUT_WHITE_UTIL_LEAST_INV = 12;

var MODE_PLAIN = 0;
var MODE_REVERSE = 1;
var MODE_INVERT = 2;
var MODE_NEGATIVE_HARMONY = 3;
var MODE_WHOLE_TONE = 4;
var MODE_PENTATONIC = 5;
var MODE_DRUNK = 6;
var MODE_MIRROR_TRICK = 7;
var MODE_CHORD_MAJOR = 8;
var MODE_CHORD_MINOR = 9;
var MODE_CHORD_POWER = 10;
var MODE_CHORD_SUS4 = 11;
var MODE_CHORD_MAJ7 = 12;
var MODE_CHORD_MIN7 = 13;
var MODE_CHORD_QUARTAL = 14;
var MODE_CHORD_BIG_HANDS = 15;
var MODE_OCTAVE_SPRAY = 16;
var MODE_STRUM_MAJOR = 17;
var MODE_ECHO_CASCADE = 18;
var MODE_CHORD_DOM9 = 19;
var MODE_CHORD_CLUSTER = 20;
var MODE_STRUM_ELEVEN_FAN = 21;
var MODE_ECHO_SPIRAL = 22;
var MODE_CHANCE_COMPANION = 23;

var PluginParameters = [
  {
    name: "Base Note (C3=48)",
    type: "lin",
    minValue: 0,
    maxValue: 127,
    numberOfSteps: 127,
    defaultValue: 48
  },
  {
    name: "Layout",
    type: "menu",
    valueStrings: LAYOUT_NAMES,
    defaultValue: 0
  },
  {
    name: "Mode",
    type: "menu",
    valueStrings: MODE_NAMES,
    defaultValue: 0
  },
  {
    name: "Keys Per Octave",
    type: "lin",
    minValue: 5,
    maxValue: 24,
    numberOfSteps: 19,
    defaultValue: 11
  }
];

function floorDiv(a, b) {
  if (b === 0) {
    return 0;
  }
  return Math.floor(a / b);
}

function mod(a, b) {
  if (b === 0) {
    return 0;
  }
  return ((a % b) + b) % b;
}

function noteKey(event) {
  return event.channel + ":" + event.pitch;
}

function makePitchMap(pitch, detune) {
  var p = Math.round(pitch);
  if (p < 0 || p > 127) {
    return null;
  }
  return {
    pitch: p,
    detune: detune || 0
  };
}

function pitchMapFromFloat(pitchFloat) {
  if (pitchFloat < 0 || pitchFloat > 127) {
    return null;
  }

  var roundedPitch = Math.round(pitchFloat);
  if (roundedPitch < 0 || roundedPitch > 127) {
    return null;
  }

  return makePitchMap(
    roundedPitch,
    (pitchFloat - roundedPitch) * CENTS_PER_SEMITONE
  );
}

function normalizePitchMap(mapped) {
  if (mapped === null || mapped === undefined) {
    return null;
  }
  if (typeof mapped === "number") {
    return makePitchMap(mapped, 0);
  }
  return mapped;
}

function applyPitchMapToNoteOn(event, mapped) {
  var pitchMap = normalizePitchMap(mapped);
  if (pitchMap === null) {
    return false;
  }

  event.pitch = pitchMap.pitch;
  event.detune = pitchMap.detune;
  return true;
}

function applyPitchMapToNoteOff(event, mapped) {
  var pitchMap = normalizePitchMap(mapped);
  if (pitchMap === null) {
    return false;
  }

  event.pitch = pitchMap.pitch;
  return true;
}

function elevenPitchFloatForIndex(inputIndex) {
  return getBaseNote() + inputIndex * getRatioStepSemitones();
}

function elevenPitchMapForStepIndex(stepIndex) {
  return pitchMapFromFloat(elevenPitchFloatForIndex(stepIndex));
}

function elevenPitchMapForStepOffset(rootPitch, stepOffset) {
  var baseNote = getBaseNote();
  var rootIndex = rootPitch - baseNote;
  return elevenPitchMapForStepIndex(rootIndex + stepOffset);
}

function pitchMapForStepOffset(rootStepIndex, stepOffset) {
  return elevenPitchMapForStepIndex(rootStepIndex + stepOffset);
}

function sendMappedNoteOn(channel, velocity, mapped, delayBeats) {
  var pitchMap = normalizePitchMap(mapped);
  if (pitchMap === null) {
    return false;
  }

  var noteOn = new NoteOn();
  noteOn.pitch = pitchMap.pitch;
  noteOn.detune = pitchMap.detune;
  noteOn.velocity = velocity;
  noteOn.channel = channel;
  if (delayBeats && delayBeats > 0) {
    noteOn.sendAfterBeats(delayBeats);
  } else {
    noteOn.send();
  }
  return true;
}

function sendMappedNoteOff(channel, velocity, mapped, delayBeats) {
  var pitchMap = normalizePitchMap(mapped);
  if (pitchMap === null) {
    return false;
  }

  var noteOff = new NoteOff();
  noteOff.pitch = pitchMap.pitch;
  noteOff.velocity = velocity;
  noteOff.channel = channel;
  if (delayBeats && delayBeats > 0) {
    noteOff.sendAfterBeats(delayBeats);
  } else {
    noteOff.send();
  }
  return true;
}

function getBaseNote() {
  return Math.round(GetParameter(PARAM_BASE_NOTE));
}

function getLayout() {
  return Math.round(GetParameter(PARAM_LAYOUT));
}

function getMode() {
  return Math.round(GetParameter(PARAM_MODE));
}

function getKeysPerOctave() {
  var value = Math.round(GetParameter(PARAM_KEYS_PER_OCTAVE));
  if (value < 1) {
    return ELEVEN_STEPS_PER_OCTAVE;
  }
  return value;
}

function getRatioStepSemitones() {
  return SEMITONES_PER_OCTAVE / getKeysPerOctave();
}

var WHITE_TRAD_INPUT_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
var WHITE_TRAD_ELEVEN_STEPS = [0, 2, 4, 5, 7, 9, 11];
var WHITE_UTIL_INPUT_OFFSETS = [0, 2, 4, 5, 6, 8, 10];
var WHITE_UTIL_ELEVEN_STEPS = [0, 2, 4, 5, 6, 8, 10];
var WHITE_BUFFER_SIZE = 16;
var SEMITONES_PER_OCTAVE = 12;
var ELEVEN_STEPS_PER_OCTAVE = 11;
var CENTS_PER_SEMITONE = 100;
var whiteCounts = [0, 0, 0, 0, 0, 0, 0];
var whiteBuffer = [];
var lastBaseNote = null;
var lastNoteOn = null;
var recentNoteOns = [];
var activeMap = {};
var leastStepCounter = 0;

// Multi-note state for chord, strum and echo modes.
var chordActiveMap = {};

// Toggle state for Mirror Trick.
var mirrorToggle = 0;

var WHOLE_TONE_LADDER_STEPS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
var PENTATONIC_CLIMB_STEPS = [0, 3, 5, 6, 9, 11, 14, 16, 17, 20, 22];

// Time-based mode constants (all tempo-synced via beats).
var STRUM_BEAT_STEP = 0.03;
var ECHO_DELAY_BEATS = 0.5;
var ECHO_DURATION_BEATS = 0.4;
var ECHO_DECAY = 0.6;
var ECHO_COUNT = 2;
var SPIRAL_ECHO_COUNT = 4;
var SPIRAL_ECHO_DELAY_BEATS = 1 / 11;
var SPIRAL_ECHO_DURATION_BEATS = 0.22;
var CHANCE_COMPANION_STEPS = [-11, -6, -3, 3, 6, 9, 11];

function isTraditionalWhiteLayout(layout) {
  return layout === LAYOUT_WHITE_TRAD_SAFE;
}

function isUtilityWhiteLayout(layout) {
  return layout === LAYOUT_WHITE_UTIL_DOWN
      || layout === LAYOUT_WHITE_UTIL_UP
      || layout === LAYOUT_WHITE_UTIL_ZIGZAG
      || layout === LAYOUT_WHITE_UTIL_THIRDS
      || layout === LAYOUT_WHITE_UTIL_FIFTHS
      || layout === LAYOUT_WHITE_UTIL_MIRROR
      || layout === LAYOUT_WHITE_UTIL_OCTAVE_UP
      || layout === LAYOUT_WHITE_UTIL_DIR
      || layout === LAYOUT_WHITE_UTIL_DIR_INV
      || layout === LAYOUT_WHITE_UTIL_LEAST
      || layout === LAYOUT_WHITE_UTIL_LEAST_INV;
}

function whiteConfigForLayout(layout) {
  if (isTraditionalWhiteLayout(layout)) {
    return {
      span: SEMITONES_PER_OCTAVE,
      inputOffsets: WHITE_TRAD_INPUT_OFFSETS,
      outputSteps: WHITE_TRAD_ELEVEN_STEPS
    };
  }

  return {
    span: ELEVEN_STEPS_PER_OCTAVE,
    inputOffsets: WHITE_UTIL_INPUT_OFFSETS,
    outputSteps: WHITE_UTIL_ELEVEN_STEPS
  };
}

function isWhiteSemitone(semitone, config) {
  for (var i = 0; i < config.inputOffsets.length; i++) {
    if (config.inputOffsets[i] === semitone) {
      return true;
    }
  }
  return false;
}

function getLowerWhiteIndex(semitone, config) {
  for (var i = config.inputOffsets.length - 1; i >= 0; i--) {
    if (config.inputOffsets[i] <= semitone) {
      return i;
    }
  }
  return 0;
}

function resetWhiteBuffer() {
  whiteCounts = [0, 0, 0, 0, 0, 0, 0];
  whiteBuffer = [];
}

function rememberNoteOn(noteNumber) {
  lastNoteOn = noteNumber;
  recentNoteOns.push(noteNumber);
  if (recentNoteOns.length > 2) {
    recentNoteOns.shift();
  }
}

function directionFromRecentNotes(currentPitch) {
  if (recentNoteOns.length >= 2) {
    var older = recentNoteOns[0];
    var newer = recentNoteOns[1];
    if (newer > older) {
      return 1;
    }
    if (newer < older) {
      return -1;
    }
  }

  if (lastNoteOn !== null) {
    if (currentPitch < lastNoteOn) {
      return -1;
    }
    if (currentPitch > lastNoteOn) {
      return 1;
    }
  }

  return 1;
}

function recordWhiteNote(noteNumber) {
  var layout = getLayout();
  if (!isTraditionalWhiteLayout(layout) && !isUtilityWhiteLayout(layout)) {
    return;
  }

  var config = whiteConfigForLayout(layout);
  var baseNote = getBaseNote();
  if (lastBaseNote === null || baseNote !== lastBaseNote) {
    resetWhiteBuffer();
    lastBaseNote = baseNote;
  }

  var inputIndex = noteNumber - baseNote;
  var semitone = mod(inputIndex, config.span);
  if (!isWhiteSemitone(semitone, config)) {
    return;
  }

  var whiteIndex = getLowerWhiteIndex(semitone, config);
  whiteBuffer.push(whiteIndex);
  whiteCounts[whiteIndex] += 1;

  if (whiteBuffer.length > WHITE_BUFFER_SIZE) {
    var removed = whiteBuffer.shift();
    whiteCounts[removed] -= 1;
  }
}

function getLeastUsedIndex(invert, fallbackIndex, advanceCounter) {
  if (whiteBuffer.length === 0) {
    return fallbackIndex;
  }

  var targetCount = invert ? -1 : 999999;
  for (var i = 0; i < whiteCounts.length; i++) {
    var count = whiteCounts[i];
    if (invert) {
      if (count > targetCount) {
        targetCount = count;
      }
    } else {
      if (count < targetCount) {
        targetCount = count;
      }
    }
  }

  var candidates = [];
  for (var j = 0; j < whiteCounts.length; j++) {
    if (whiteCounts[j] === targetCount) {
      candidates.push(j);
    }
  }

  if (candidates.length === 0) {
    return fallbackIndex;
  }

  candidates.sort(function (a, b) {
    return Math.abs(a - fallbackIndex) - Math.abs(b - fallbackIndex);
  });

  var index = candidates[0];
  if (candidates.length > 1) {
    if (advanceCounter) {
      leastStepCounter += 1;
    }
    var pick = mod(leastStepCounter, candidates.length);
    index = candidates[pick];
  }

  return index;
}

// Ratio tuning: by default eleven physical semitone keys span one full octave.
// Raising Keys Per Octave compresses the steps; lowering it stretches them.
function mapPlain(noteNumber, direction) {
  return mapLayoutPitch(noteNumber, direction);
}

// Reverse runs each ratio octave band backward while the octave anchors still
// land in order. It makes scalar playing fold back on itself.
function mapReverse(noteNumber, direction) {
  var inputIndex = mapLayoutStepIndex(noteNumber, direction);
  var keysPerOctave = getKeysPerOctave();
  var octave = floorDiv(inputIndex, keysPerOctave);
  var step = mod(inputIndex, keysPerOctave);
  var reversedStep = step === 0 ? 0 : keysPerOctave - step;
  var pitchFloat = getBaseNote() + octave * SEMITONES_PER_OCTAVE + reversedStep * getRatioStepSemitones();
  return pitchMapFromFloat(pitchFloat);
}

// Inverted ratio tuning: higher keys fall and lower keys rise around the base note.
function mapInvert(noteNumber, direction) {
  var inputIndex = mapLayoutStepIndex(noteNumber, direction);
  var pitchFloat = getBaseNote() - inputIndex * getRatioStepSemitones();
  return pitchMapFromFloat(pitchFloat);
}

function mapWhiteKeysStepIndex(noteNumber, layout, direction) {
  var config = whiteConfigForLayout(layout);
  var baseNote = getBaseNote();
  var inputIndex = noteNumber - baseNote;
  var octave = floorDiv(inputIndex, config.span);
  var semitone = mod(inputIndex, config.span);

  var isWhite = isWhiteSemitone(semitone, config);
  var whiteIndex = getLowerWhiteIndex(semitone, config);
  var stepOffset = config.outputSteps[whiteIndex];

  if (isWhite) {
    return octave * ELEVEN_STEPS_PER_OCTAVE + stepOffset;
  }

  var step = 0;
  if (layout === LAYOUT_WHITE_UTIL_UP) {
    step = 1;
  } else if (layout === LAYOUT_WHITE_TRAD_SAFE) {
    // This is the only static 12-key traditional assignment that keeps the
    // 11-step octave reset and avoids three adjacent same-pitch keys.
    if (semitone === 1 || semitone === 3) {
      step = 1;
    } else {
      step = 0;
    }
  } else if (layout === LAYOUT_WHITE_UTIL_ZIGZAG) {
    // Utility zigzag follows the compact 11-key spine and avoids 3-key repeats.
    if (semitone === 3 || semitone === 9) {
      step = 1;
    } else {
      step = 0;
    }
  } else if (layout === LAYOUT_WHITE_UTIL_THIRDS) {
    step = 2;
  } else if (layout === LAYOUT_WHITE_UTIL_FIFTHS) {
    step = 4;
  } else if (layout === LAYOUT_WHITE_UTIL_MIRROR) {
    step = (6 - whiteIndex) - whiteIndex;
  } else if (layout === LAYOUT_WHITE_UTIL_OCTAVE_UP) {
    step = 7;
  } else if (layout === LAYOUT_WHITE_UTIL_DIR || layout === LAYOUT_WHITE_UTIL_DIR_INV) {
    var dir = direction || 1;
    if (layout === LAYOUT_WHITE_UTIL_DIR_INV) {
      dir = -dir;
    }
    step = dir > 0 ? 1 : 0;
  } else if (layout === LAYOUT_WHITE_UTIL_LEAST || layout === LAYOUT_WHITE_UTIL_LEAST_INV) {
    var targetIndex = getLeastUsedIndex(layout === LAYOUT_WHITE_UTIL_LEAST_INV, whiteIndex, true);
    step = targetIndex - whiteIndex;
  }

  var targetIndex = whiteIndex + step;
  var extraOctave = floorDiv(targetIndex, config.outputSteps.length);
  var targetOffset = config.outputSteps[mod(targetIndex, config.outputSteps.length)];
  return (octave + extraOctave) * ELEVEN_STEPS_PER_OCTAVE + targetOffset;
}

function mapLayoutStepIndex(noteNumber, direction) {
  var layout = getLayout();
  if (layout === LAYOUT_CHROMATIC) {
    return noteNumber - getBaseNote();
  }

  return mapWhiteKeysStepIndex(noteNumber, layout, direction);
}

function mapLayoutPitch(noteNumber, direction) {
  return elevenPitchMapForStepIndex(mapLayoutStepIndex(noteNumber, direction));
}

// Negative harmony in the 11-step octave. The input step is reflected inside
// its current 11-step band, then converted through the shared 11-EDO output.
function mapNegativeHarmony(noteNumber, direction) {
  var inputIndex = mapLayoutStepIndex(noteNumber, direction);
  var octave = floorDiv(inputIndex, ELEVEN_STEPS_PER_OCTAVE);
  var step = mod(inputIndex, ELEVEN_STEPS_PER_OCTAVE);
  var newStep = mod(7 - step, ELEVEN_STEPS_PER_OCTAVE);
  return elevenPitchMapForStepIndex(octave * ELEVEN_STEPS_PER_OCTAVE + newStep);
}

function mapStepPattern(noteNumber, direction, pattern) {
  var inputIndex = mapLayoutStepIndex(noteNumber, direction);
  var octave = floorDiv(inputIndex, ELEVEN_STEPS_PER_OCTAVE);
  var step = mod(inputIndex, ELEVEN_STEPS_PER_OCTAVE);
  return elevenPitchMapForStepIndex(octave * ELEVEN_STEPS_PER_OCTAVE + pattern[step]);
}

function mapDrunkWobble(noteNumber, direction) {
  var wobble = Math.floor(Math.random() * 3) - 1;
  return pitchMapForStepOffset(mapLayoutStepIndex(noteNumber, direction), wobble);
}

// Mirror Trick toggles each note: even hits use the normal 11-EDO mapping,
// odd hits reflect around the base note in the same 11-step space.
function mapMirrorTrick(noteNumber, direction) {
  mirrorToggle += 1;
  if (mirrorToggle % 2 === 0) {
    return mapPlain(noteNumber, direction);
  }
  return elevenPitchMapForStepIndex(-mapLayoutStepIndex(noteNumber, direction));
}

function chordIntervalsForMode(mode) {
  if (mode === MODE_CHORD_MAJOR) return [0, 4, 6];
  if (mode === MODE_CHORD_MINOR) return [0, 3, 6];
  if (mode === MODE_CHORD_POWER) return [0, 6];
  if (mode === MODE_CHORD_SUS4) return [0, 5, 6];
  if (mode === MODE_CHORD_MAJ7) return [0, 4, 6, 10];
  if (mode === MODE_CHORD_MIN7) return [0, 3, 6, 9];
  if (mode === MODE_CHORD_QUARTAL) return [0, 5, 10, 15];
  if (mode === MODE_CHORD_BIG_HANDS) return [-11, 0, 6, 17];
  if (mode === MODE_OCTAVE_SPRAY) return [-11, 0, 11];
  if (mode === MODE_STRUM_MAJOR) return [0, 4, 6, 11];
  if (mode === MODE_CHORD_DOM9) return [0, 4, 6, 9, 14];
  if (mode === MODE_CHORD_CLUSTER) return [0, 1, 2, 3];
  if (mode === MODE_STRUM_ELEVEN_FAN) return [-11, 0, 3, 6, 9, 11];
  return null;
}

function isChordishMode(mode) {
  return chordIntervalsForMode(mode) !== null;
}

function isMultiNoteMode(mode) {
  return isChordishMode(mode)
      || mode === MODE_ECHO_CASCADE
      || mode === MODE_ECHO_SPIRAL
      || mode === MODE_CHANCE_COMPANION;
}

function chordVelocityForVoice(baseVel, voiceIndex) {
  var v = baseVel - voiceIndex * 4;
  if (v < 1) {
    v = 1;
  }
  return v;
}

function mapPitch(noteNumber, direction) {
  var mode = getMode();
  if (mode === MODE_REVERSE) return mapReverse(noteNumber, direction);
  if (mode === MODE_INVERT) return mapInvert(noteNumber, direction);
  if (mode === MODE_NEGATIVE_HARMONY) return mapNegativeHarmony(noteNumber, direction);
  if (mode === MODE_WHOLE_TONE) return mapStepPattern(noteNumber, direction, WHOLE_TONE_LADDER_STEPS);
  if (mode === MODE_PENTATONIC) return mapStepPattern(noteNumber, direction, PENTATONIC_CLIMB_STEPS);
  if (mode === MODE_DRUNK) return mapDrunkWobble(noteNumber, direction);
  if (mode === MODE_MIRROR_TRICK) return mapMirrorTrick(noteNumber, direction);
  return mapPlain(noteNumber, direction);
}

function mapPitchWithDirection(noteNumber, direction) {
  return mapPitch(noteNumber, direction);
}

function usesStableMapping(mode, layout) {
  return layout === LAYOUT_WHITE_UTIL_DIR
      || layout === LAYOUT_WHITE_UTIL_DIR_INV
      || layout === LAYOUT_WHITE_UTIL_LEAST
      || layout === LAYOUT_WHITE_UTIL_LEAST_INV
      || mode === MODE_DRUNK
      || mode === MODE_MIRROR_TRICK;
}

function handleMultiNoteOn(event) {
  var mode = getMode();
  var rootPitch = event.pitch;
  var direction = directionFromRecentNotes(rootPitch);
  var rootStepIndex = mapLayoutStepIndex(rootPitch, direction);
  var baseVelocity = event.velocity;
  var channel = event.channel;
  var tiedMaps = [];

  if (mode === MODE_ECHO_CASCADE) {
    var rootMap = pitchMapForStepOffset(rootStepIndex, 0);
    if (sendMappedNoteOn(channel, baseVelocity, rootMap, 0)) {
      tiedMaps.push(rootMap);
    }

    var echoVel = baseVelocity;
    for (var i = 1; i <= ECHO_COUNT; i++) {
      echoVel = Math.round(echoVel * ECHO_DECAY);
      if (echoVel < 1) break;
      sendMappedNoteOn(channel, echoVel, rootMap, i * ECHO_DELAY_BEATS);
      sendMappedNoteOff(channel, 0, rootMap, i * ECHO_DELAY_BEATS + ECHO_DURATION_BEATS);
    }
  } else if (mode === MODE_ECHO_SPIRAL) {
    var firstMap = pitchMapForStepOffset(rootStepIndex, 0);
    if (sendMappedNoteOn(channel, baseVelocity, firstMap, 0)) {
      tiedMaps.push(firstMap);
    }

    var spiralVel = baseVelocity;
    for (var s = 1; s <= SPIRAL_ECHO_COUNT; s++) {
      spiralVel = Math.round(spiralVel * ECHO_DECAY);
      if (spiralVel < 1) break;
      var spiralMap = pitchMapForStepOffset(rootStepIndex, s);
      var delay = s * SPIRAL_ECHO_DELAY_BEATS;
      sendMappedNoteOn(channel, spiralVel, spiralMap, delay);
      sendMappedNoteOff(channel, 0, spiralMap, delay + SPIRAL_ECHO_DURATION_BEATS);
    }
  } else if (mode === MODE_CHANCE_COMPANION) {
    var chanceRootMap = pitchMapForStepOffset(rootStepIndex, 0);
    if (sendMappedNoteOn(channel, baseVelocity, chanceRootMap, 0)) {
      tiedMaps.push(chanceRootMap);
    }

    var pick = Math.floor(Math.random() * CHANCE_COMPANION_STEPS.length);
    var companionMap = pitchMapForStepOffset(rootStepIndex, CHANCE_COMPANION_STEPS[pick]);
    if (sendMappedNoteOn(channel, chordVelocityForVoice(baseVelocity, 1), companionMap, 0)) {
      tiedMaps.push(companionMap);
    }

    if (Math.random() < 0.35) {
      var secondPick = Math.floor(Math.random() * CHANCE_COMPANION_STEPS.length);
      var secondMap = pitchMapForStepOffset(rootStepIndex, CHANCE_COMPANION_STEPS[secondPick]);
      if (sendMappedNoteOn(channel, chordVelocityForVoice(baseVelocity, 2), secondMap, STRUM_BEAT_STEP)) {
        tiedMaps.push(secondMap);
      }
    }
  } else {
    var intervals = chordIntervalsForMode(mode);
    var isStrum = (mode === MODE_STRUM_MAJOR || mode === MODE_STRUM_ELEVEN_FAN);
    for (var j = 0; j < intervals.length; j++) {
      var pitchMap = pitchMapForStepOffset(rootStepIndex, intervals[j]);
      if (pitchMap === null) continue;
      var v = chordVelocityForVoice(baseVelocity, j);
      var noteDelay = isStrum && j > 0 ? j * STRUM_BEAT_STEP : 0;
      if (sendMappedNoteOn(channel, v, pitchMap, noteDelay)) {
        tiedMaps.push(pitchMap);
      }
    }
  }

  chordActiveMap[noteKey(event)] = tiedMaps;
  rememberNoteOn(rootPitch);
}

function handleMultiNoteOff(event) {
  var key = noteKey(event);
  var maps = chordActiveMap[key];
  if (!maps) {
    return;
  }
  for (var i = 0; i < maps.length; i++) {
    sendMappedNoteOff(event.channel, event.velocity, maps[i], 0);
  }
  delete chordActiveMap[key];
}

function HandleMIDI(event) {
  if (event instanceof NoteOn) {
    var mode = getMode();
    var layout = getLayout();
    var key = noteKey(event);
    recordWhiteNote(event.pitch);

    if (isMultiNoteMode(mode)) {
      handleMultiNoteOn(event);
      return;
    }

    var mappedPitch = null;
    if (usesStableMapping(mode, layout)) {
      var direction = directionFromRecentNotes(event.pitch);
      mappedPitch = mapPitchWithDirection(event.pitch, direction);
      activeMap[key] = normalizePitchMap(mappedPitch);
    } else {
      mappedPitch = mapPitch(event.pitch, 1);
      activeMap[key] = normalizePitchMap(mappedPitch);
    }
    rememberNoteOn(event.pitch);

    if (!applyPitchMapToNoteOn(event, mappedPitch)) {
      return;
    }
    event.send();
    return;
  }

  if (event instanceof NoteOff) {
    var offKey = noteKey(event);
    if (chordActiveMap.hasOwnProperty(offKey)) {
      handleMultiNoteOff(event);
      return;
    }

    var mappedPitch = null;
    if (activeMap.hasOwnProperty(offKey)) {
      mappedPitch = activeMap[offKey];
      delete activeMap[offKey];
    } else {
      mappedPitch = mapPitch(event.pitch, 1);
    }

    if (!applyPitchMapToNoteOff(event, mappedPitch)) {
      return;
    }
    event.send();
    return;
  }

  event.send();
}
