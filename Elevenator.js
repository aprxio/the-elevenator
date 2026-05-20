// Logic Pro Scripter: Elevenator (11 steps per 12 keys)

var PARAM_BASE_NOTE = 0;
var PARAM_MODE = 1;

var MODE_NAMES = [
  "Elevenator (11/12)",
  "Elevenator Reverse (11/12)",
  "Elevenator Invert (11/12)",
  "White Keys: Down",
  "White Keys: Up",
  "White Keys: Zigzag",
  "White Keys: Thirds",
  "White Keys: Fifths",
  "White Keys: Mirror",
  "White Keys: Octave Up",
  "White Keys: Direction",
  "White Keys: Direction Invert",
  "White Keys: Least Used",
  "White Keys: Least Used Invert"
];

var MODE_ELEVENATOR = 0;
var MODE_ELEVENATOR_REVERSE = 1;
var MODE_ELEVENATOR_INVERT = 2;
var MODE_WHITE_DOWN = 3;
var MODE_WHITE_UP = 4;
var MODE_WHITE_ZIGZAG = 5;
var MODE_WHITE_THIRDS = 6;
var MODE_WHITE_FIFTHS = 7;
var MODE_WHITE_MIRROR = 8;
var MODE_WHITE_OCTAVE_UP = 9;
var MODE_WHITE_DIR = 10;
var MODE_WHITE_DIR_INV = 11;
var MODE_WHITE_LEAST = 12;
var MODE_WHITE_LEAST_INV = 13;

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
    name: "Mode",
    type: "menu",
    valueStrings: MODE_NAMES,
    defaultValue: 0
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

function getBaseNote() {
  return Math.round(GetParameter(PARAM_BASE_NOTE));
}

function getMode() {
  return Math.round(GetParameter(PARAM_MODE));
}

var WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
var WHITE_BUFFER_SIZE = 16;
var whiteCounts = [0, 0, 0, 0, 0, 0, 0];
var whiteBuffer = [];
var lastBaseNote = null;
var lastNoteOn = null;
var activeMap = {};
var leastStepCounter = 0;

function isWhiteSemitone(semitone) {
  for (var i = 0; i < WHITE_OFFSETS.length; i++) {
    if (WHITE_OFFSETS[i] === semitone) {
      return true;
    }
  }
  return false;
}

function getLowerWhiteIndex(semitone) {
  for (var i = WHITE_OFFSETS.length - 1; i >= 0; i--) {
    if (WHITE_OFFSETS[i] <= semitone) {
      return i;
    }
  }
  return 0;
}

function resetWhiteBuffer() {
  whiteCounts = [0, 0, 0, 0, 0, 0, 0];
  whiteBuffer = [];
}

function recordWhiteNote(noteNumber) {
  var baseNote = getBaseNote();
  if (lastBaseNote === null || baseNote !== lastBaseNote) {
    resetWhiteBuffer();
    lastBaseNote = baseNote;
  }

  var inputIndex = noteNumber - baseNote;
  var semitone = mod(inputIndex, 12);
  if (!isWhiteSemitone(semitone)) {
    return;
  }

  var whiteIndex = getLowerWhiteIndex(semitone);
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

function mapElevenator(noteNumber) {
  var baseNote = getBaseNote();
  var inputIndex = noteNumber - baseNote;
  var shift = floorDiv(inputIndex, 12);
  var outputIndex = inputIndex - shift;
  var mapped = baseNote + outputIndex;

  if (mapped < 0 || mapped > 127) {
    return null;
  }

  return mapped;
}

function mapElevenatorReverse(noteNumber) {
  var baseNote = getBaseNote();
  var inputIndex = noteNumber - baseNote;
  var shift = floorDiv(inputIndex + 11, 12);
  var outputIndex = inputIndex - shift;
  var mapped = baseNote + outputIndex;

  if (mapped < 0 || mapped > 127) {
    return null;
  }

  return mapped;
}

function mapElevenatorInvert(noteNumber) {
  var baseNote = getBaseNote();
  var inputIndex = noteNumber - baseNote;
  var shift = floorDiv(inputIndex, 12);
  var outputIndex = inputIndex - shift;
  var mapped = baseNote - outputIndex;

  if (mapped < 0 || mapped > 127) {
    return null;
  }

  return mapped;
}

function mapWhiteKeys(noteNumber, mode, direction) {
  var baseNote = getBaseNote();
  var inputIndex = noteNumber - baseNote;
  var octave = floorDiv(inputIndex, 12);
  var semitone = mod(inputIndex, 12);

  var isWhite = isWhiteSemitone(semitone);
  var whiteIndex = getLowerWhiteIndex(semitone);
  var offset = WHITE_OFFSETS[whiteIndex];

  if (isWhite) {
    return baseNote + octave * 12 + offset;
  }

  var step = 0;
  if (mode === MODE_WHITE_UP) {
    step = 1;
  } else if (mode === MODE_WHITE_ZIGZAG) {
    // Zigzag: alternate up/down on black keys for a lopsided groove.
    if (semitone === 1 || semitone === 6 || semitone === 10) {
      step = 1;
    } else {
      step = 0;
    }
  } else if (mode === MODE_WHITE_THIRDS) {
    step = 2;
  } else if (mode === MODE_WHITE_FIFTHS) {
    step = 4;
  } else if (mode === MODE_WHITE_MIRROR) {
    step = (6 - whiteIndex) - whiteIndex;
  } else if (mode === MODE_WHITE_OCTAVE_UP) {
    step = 7;
  } else if (mode === MODE_WHITE_DIR || mode === MODE_WHITE_DIR_INV) {
    var dir = direction || 1;
    if (mode === MODE_WHITE_DIR_INV) {
      dir = -dir;
    }
    step = dir > 0 ? 1 : 0;
  } else if (mode === MODE_WHITE_LEAST || mode === MODE_WHITE_LEAST_INV) {
    var targetIndex = getLeastUsedIndex(mode === MODE_WHITE_LEAST_INV, whiteIndex, true);
    step = targetIndex - whiteIndex;
  }

  var targetIndex = whiteIndex + step;
  var extraOctave = floorDiv(targetIndex, 7);
  var targetOffset = WHITE_OFFSETS[mod(targetIndex, 7)] + extraOctave * 12;
  var mapped = baseNote + octave * 12 + targetOffset;

  if (mapped < 0 || mapped > 127) {
    return null;
  }

  return mapped;
}

function mapPitch(noteNumber) {
  var mode = getMode();
  if (mode === MODE_ELEVENATOR) {
    return mapElevenator(noteNumber);
  }
  if (mode === MODE_ELEVENATOR_REVERSE) {
    return mapElevenatorReverse(noteNumber);
  }
  if (mode === MODE_ELEVENATOR_INVERT) {
    return mapElevenatorInvert(noteNumber);
  }

  return mapWhiteKeys(noteNumber, mode, 1);
}

function mapPitchWithDirection(noteNumber, direction) {
  var mode = getMode();
  if (mode === MODE_ELEVENATOR) {
    return mapElevenator(noteNumber);
  }
  if (mode === MODE_ELEVENATOR_REVERSE) {
    return mapElevenatorReverse(noteNumber);
  }
  if (mode === MODE_ELEVENATOR_INVERT) {
    return mapElevenatorInvert(noteNumber);
  }

  return mapWhiteKeys(noteNumber, mode, direction);
}

function usesStableMapping(mode) {
  return mode === MODE_WHITE_DIR || mode === MODE_WHITE_DIR_INV || mode === MODE_WHITE_LEAST || mode === MODE_WHITE_LEAST_INV;
}

function HandleMIDI(event) {
  if (event instanceof NoteOn || event instanceof NoteOff) {
    var mode = getMode();
    var mappedPitch = null;

    if (event instanceof NoteOn) {
      recordWhiteNote(event.pitch);
    }

    if (event instanceof NoteOn && usesStableMapping(mode)) {
      if (mode === MODE_WHITE_DIR || mode === MODE_WHITE_DIR_INV) {
        var direction = 1;
        if (lastNoteOn !== null && event.pitch < lastNoteOn) {
          direction = -1;
        }
        mappedPitch = mapPitchWithDirection(event.pitch, direction);
      } else {
        mappedPitch = mapPitch(event.pitch);
      }
      activeMap[event.pitch] = mappedPitch;
      lastNoteOn = event.pitch;
    } else if (event instanceof NoteOff && activeMap.hasOwnProperty(event.pitch)) {
      mappedPitch = activeMap[event.pitch];
      delete activeMap[event.pitch];
    } else {
      mappedPitch = mapPitch(event.pitch);
      if (event instanceof NoteOn) {
        lastNoteOn = event.pitch;
      }
    }

    if (mappedPitch === null) {
      return;
    }
    event.pitch = mappedPitch;
    event.send();
    return;
  }

  event.send();
}
