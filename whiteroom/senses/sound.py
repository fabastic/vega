from mind.types import SoundSample
from whiteroom.room import bearing_to


def hear(room, pos, heading):
    sources = tuple((bearing_to(pos, heading, cell)[0], lvl) for cell, lvl in room.sound_sources)
    return SoundSample(room.ambient_sound, sources)
