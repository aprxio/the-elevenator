# Elevenator

Elevenator is a Logic Pro Scripter plugin that re-spaces the keyboard into 11 pitch steps per 12 keys. One pitch is duplicated at the octave boundary, so the scale advances with a deliberate, mechanical hitch. Think of a clockwork loop that skips a tooth and still keeps time.

## How it works

- Every 12 physical keys become 11 distinct pitches.
- The duplicate happens at B-C and continues across the keyboard.
- The rest of the keys advance in normal semitone steps.

## Controls

- **Base Note (C3=48):** The MIDI note number where the mapping starts.
- **Mode:** Elevenator, Elevenator Reverse, Elevenator Invert, or one of the white-key modes below.

## Usage

1. Open the Software Instrument track in Logic Pro.
2. Add a MIDI FX slot and choose **Scripter**.
3. In the Scripter window, click the preset menu and choose **Open Script...**.
4. Select [Elevenator.js](Elevenator.js).
5. Play the keyboard and adjust **Base Note** and **Mode** to taste.

### White-key modes

- **White Keys: Down** maps black keys down to the nearest white key.
- **White Keys: Up** maps black keys up to the nearest white key.
- **White Keys: Zigzag** alternates black keys up or down for a skewed contour.
- **White Keys: Thirds** maps black keys up two white steps.
- **White Keys: Fifths** maps black keys up four white steps.
- **White Keys: Mirror** reflects black keys around the white-key spine of the octave.
- **White Keys: Octave Up** maps black keys up one white-key octave.
- **White Keys: Direction** maps black keys up or down based on playing direction.
- **White Keys: Direction Invert** flips the direction rule for the same motion.
- **White Keys: Least Used** maps black keys to the least-used white step in recent memory.
- **White Keys: Least Used Invert** maps black keys to the most-used white step.

## Quick example

Default settings (Base Note 48, Elevenator mode) mean the B and C keys sound the same pitch. Move up 12 keys on your keyboard and you will have climbed 11 semitones. It is a small, disciplined shift, a little Ludovico tick-tock in the tuning room.

Elevenator Reverse shifts the duplicate to the start of the octave span, so the C and C# keys share the same pitch, then the scale resumes its 11-step march.

Elevenator Invert flips pitch direction while keeping the 11-step compression, so higher keys fall and lower keys rise around the base note.

## Notes

- This script only remaps note-on and note-off events; everything else passes through.
- Direction modes follow your note-on motion; note-off stays locked to the original mapping.
- Least-used modes follow recent white-key motion; ties rotate for more variance, and note-off stays locked to the original mapping.
- If it feels unfamiliar, that is the point: a precise detour, not a malfunction.
