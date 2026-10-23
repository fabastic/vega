// =====================================================================
// FEELINGS: a lexicon of human emotions, each driven by the state of the body and mind
// =====================================================================
// About a hundred families (fear, longing, lust, awe...) are computed from his state. Every word in the
// lexicon belongs to one family at an intensity band: 1 a trace, 2 clearly felt, 3 overwhelming.
// A handful of words name precise situations rather than intensities; those have their own triggers.
const LEXICON = `
fear:1:Apprehension,Cautious,Spooked,Intimidated|2:Alarmed,Fear,Frightened,Menaced,Threatened|3:Petrified,Terrified
panic:1:Panicky|2:Panic,Frantic,Wild-eyed|3:Frenzied,Hysterical
anxiety:1:Fretful,Reactive,Rigid,Ruffled,Tense,Tight,Uptight,Unsettled|2:Jittery,Nervousness,On-edge,Skittish,Twitchy,Unnerved|3:Jumpy,Wound-up
dread:1:Sinister|2:Dread|3:Doomed
anger:1:Cross,Provoked,Heated|2:Anger,Fiery,Indignant|3:Explosive,Fuming,Fury,Incensed,Irate,Livid,Outrage,Rage,Seething
irritable:1:Cranky,Fussy,Grumpy,Miffed,Moody,Peevish,Piqued,Sulky,Sulking,Testy,Touchy|2:Frustration,Irritable,Petulant,Prickly,Snappy,Surly,Thwarted|3:Exasperated
aggress:1:Antagonistic,Punchy|2:Aggressive,Belligerent,Combative,Fierce,Hostility,Truculent|3:Bellicose,Destructive,Vicious
cruel:1:Mean,Nasty,Wicked|2:Heartless,Malicious,Spiteful|3:Cruel,Malevolent,Ruthless
vengeful:1:Aggrieved|2:Vengeful,Resentment|3:Vindictive
defiant:1:Contrary,Feisty,Inflexible,Stubborn,Unruly|2:Defiant,Insubordinate,Obstinate,Recalcitrant|3:Rebellious
sad:1:Dismal,Gloom,Somber,Sullen|2:Dejected,Heavy,Morose,Sadness|3:Lugubrious,Sorrow,Woebegone
grief:1:Mourning|2:Grief|3:Bereft
despair:1:Bleak,Grim,Languishing|2:Desolate,Hopeless,Misery|3:Despair,Desperate
doom:1:Cursed,Fatalistic|2:Doomed|3:Damned
defeat:1:Discouraged,Resigned|2:Beaten,Demoralized|3:Defeated
disappoint:1:Deflated,Underwhelmed,Unfulfilled|2:Crestfallen,Disappointment,Disheartened|3:Dismayed
lonely:1:Neglected,Derelict|2:Ignored,Loneliness|3:Invisible
isolated:1:Standoffish|2:Alienated,Isolated,Outcast|3:Ostracized
abandon:1:Adrift|2:Abandoned|3:Forsaken
heartbreak:1:Rejected|2:Heartbreak|3:Crushed
longing:1:Wistful|2:Longing,Yearning|3:Lovesick
nostalgia:1:Halcyon|2:Maudlin,Nostalgic|3:Homesick
shame:1:Inadequate,Inferior|2:Incompetent,Shame|3:Disgrace,Mortification,Worthless
guilt:1:Penitent,Regret|2:Contrition,Guilt,Repentant|3:Remorse
embarrass:1:Bashful,Sheepishness|2:Chagrined,Embarrassment,Flustered|3:Exposed
disgust:1:Aversion,Distaste|2:Disgust,Repelled,Sickened|3:Appalled,Repulsed,Revolted,Revulsion
contempt:1:Critical,Snarky|2:Contempt,Disdain,Misanthropic|3:Loathing,Scorn
envy:1:Upstaged|2:Covetous,Envious|3:Invidious
jealous:1:Insecure|2:Jealous|3:Possessive
bored:1:Dreary,Idle|2:Bored|3:Ennui
apathy:1:Indifferent,Laconic|2:Apathetic,Listless|3:Torpid
numb:1:Emptiness,Suppressed|2:Anhedonia,Hollow,Numb|3:Catatonic
tired:1:Drawn,Languid,Lazy|2:Foggy,Sluggish|3:Lethargic,Threadbare,Wrung-out
rested:1:Renewed|2:Refreshed,Restful|3:Revitalized
sated:1:Sated|3:Satiated
hungry:2:Hungry
thirsty:2:Thirsty
cold:1:Icy|2:Cold|3:Frigid
cozy:1:Comfortable|2:Snug,Cozy|3:Warmth
sick:1:Dizzy,Woozy|2:Feverish,Nauseated|3:Delirious
weak:1:Delicate|2:Frail,Weak|3:Helpless
confused:1:Befuddled,Dazed,Hazy,Ignorant,Mixed-up,Muddled,Mystified,Puzzled,Stumped,Unfocused,Scattered|2:Baffled,Confounded,Disoriented,Flummoxed,Lost,Perplexed|3:Bewildered,Discombobulated
dissoc:1:Disconnected,Floating|2:Detached,Disjointed,Unmoored|3:Dissociated
mad:1:Intoxicated|2:Unhinged,Chaotic|3:Deranged,Possessed
haunted:1:Psychic|2:Haunted|3:Hunted
paranoid:1:Voyeuristic|2:Stalked,Suspicious|3:Menaced
distrust:1:Biased,Prejudiced,Skeptical|2:Distrustful,Dubious|3:Cynical
wary:1:Guarded,Reticent|2:Defensive,Leery,Wary|3:Vigilance
trust:1:Gullible|2:Innocent,Trusting|3:Faithful
betrayed:1:Insulted,Offended|2:Resentment|3:Betrayed
vulnerable:1:Sensitive,Insecure|2:Defenseless,Fragile,Vulnerability,Bullied|3:Naked,Raw
powerless:1:Incapable,Small,Insignificant,Stymied|2:Helpless,Powerless,Useless,Oppressed|3:Paralyzed,Frozen
submissive:1:Deferential,Pliant|2:Submissive|3:Obsequious,Subservient
trapped:1:Confined,Restricted,Stifled|2:Cornered,Trapped,Smothered|3:Caged,Suffocated
overwhelm:1:Burdened,Pressured,Strained,Weighed-down|2:Overloaded,Stressed,Swamped|3:Overwhelmed
conflicted:1:Ambivalent|2:Conflicted,Torn|3:Paradoxical
doubt:1:Dubious,Hesitant,Uncertain,Unsure|2:Doubtful,Indecisive,Irresolute
restless:1:Antsy,Distracted|2:Agitated,Impatient,Restless|3:Frantic
anticip:1:Eager,Keen|2:Anticipation,Expectancy|3:Breathless
excite:1:Activated,Animated,Dynamic,Energetic,Lively,Spirited,Sprightly,Stimulated|2:Enthusiasm,Excitement,Invigorated,Vibrant,Agog|3:Electric,Exhilarated,Hyped,Pumped,Thrilled
joy:1:Cheerfulness,Gladness,Sunny,Vivacious,Jaunty|2:Delight,Effervescent,Glowing,Happiness,Joy,Gleeful,Celebratory|3:Beaming,Bliss,Ecstatic,Elation,Euphoria,Jubilant,Radiant,Rapturous,Soaring
play:1:Entertained,Festive,Gossipy,Lighthearted,Silly,Tickled|2:Carefree,Goofy,Humorous,Impish,Mischievous,Playful,Amused|3:Frolicsome,Uninhibited,Wacky,Zany
content:1:Peachy,Settled,Bucolic|2:Content,Satisfaction|3:Fulfilled
calm:1:Accepting,Collected,Composed,Easygoing,Mellow,Mild,Relaxed,Tolerant,Unbothered,Unhurried,Unworried,Tactful,Quiet,Open|2:Balanced,Calm,Grounded,Peaceful,Placid,Steady,Still,Undisturbed,Untroubled|3:Centered,Harmonious,Serene,Tranquil,Zen
safe:1:Secure|2:Safe|3:Cherished
relief:1:Soothed|2:Relief,Absolved|3:Miraculous
grateful:1:Appreciative,Humbled,Indebted|2:Grateful,Graced,Thankful|3:Blessed
pride:1:Honored,Self-esteem,Vain,Validation,Sanctimonious,Smarmy|2:Conceited,Haughty,Pride,Proud,Smug,Vindicated|3:Arrogant,Imperious,Triumph,Victorious
dom:1:Empowered|2:Bold|3:Invincible
courage:1:Plucky,Spunky|2:Brave,Courage,Daring|3:Audacious,Fearless
determ:1:Ambitious,Earnest,Motivated,Strict|2:Committed,Determination,Resolute,Steadfast|3:Driven,Relentless,Unstoppable,Zealous
stoic:1:Patient,Stern,Unruffled|2:Stoic|3:Unflappable
hope:1:Renewed|2:Buoyant,Hope,Sanguine,Uplifted|3:Inspired
love:1:Fondness,Faithful|2:Devoted,Love,Enamored|3:Adoration
affection:1:Platonic|2:Affectionate|3:Warmth
tender:1:Gentle,Soft|2:Familial,Tender|3:Nurturing
care:1:Charitable,Forgiving,Generous,Sympathy|2:Altruistic,Caring,Empathetic,Merciful,Selfless|3:Compassionate,Magnanimous
romance:1:Romantic,Amorous|2:Ardent,Passionate,Starry-eyed|3:Fervent,Intimate,Swept-away
attract:1:Allured,Charmed,Enticed,Lured|2:Attracted,Beguiled,Magnetized,Tantalized|3:Bewitched,Infatuated,Limerent,Smitten,Swooning
lust:1:Flushed,Sensual,Tempted|2:Aroused,Horny,Seduced,Smoldering|3:Carnal,Erotic,Lustful
needy:1:Codependent|2:Needy
connected:1:Communal,Receptive|2:Bonded,Connected|3:Intertwined
protect:2:Protective|3:Vigilance
curious:1:Inquisitive,Interest,Open-minded|2:Curiosity,Fascinated,Intrigue,Probing|3:Captivated,Enthralled,Hypnotized,Mesmerized,Spellbound
analytic:1:Informed,Objective,Observant|2:Analytical,Knowledgeable,Logical,Perceptive,Rational,Clear-headed|3:Insightful,Lucid
awe:1:Enchanted,Reverent,Wonder|2:Awe,Magical,Ineffable|3:Awe-struck,Wonderstruck
surprise:1:Startled|2:Amazement,Surprise|3:Astonishment,Flabbergasted
shock:1:Disbelief|2:Shock|3:Aghast,Horrified
contemplate:1:Introspective,Intuitive,Pensive,Reflective,Subjective|2:Contemplative,Philosophical|3:Wise
brood:1:Brooding|2:Ruminative
morbid:1:Macabre|2:Morbid
nihil:1:Pessimistic|2:Jaded,World-weary,Nihilistic|3:Weltschmerz
transcend:1:Awakened,Elevated|2:Boundless,Sublime,Transported|3:Enlightened,Transcendent
wander:1:Restless|2:Adventurous|3:Wanderlust
feral:1:Primal,Uncouth|2:Feral,Untamed,Wild
crave:1:Tempted|2:Craving,Addicted|3:Insatiable
obsess:1:Fixated|2:Obsessed|3:Consumed
volatile:1:Moody|2:Tempestuous,Turbulent|3:Volatile
solemn:1:Serious|2:Grave,Solemn
quixotic:3:Quixotic
special:0:Awumbuk,Chrysalism,Fernweh,Forelsket,Gigil,Iktsuarpok,Kenopsia,L'appel du vide,Litost,Mono no aware,Monachopsis,Onism,Saudade,Sonder,Toska,Schadenfreude,Aligned,Dynamic`;
// words the reader may not know
const EMO_DEF = {
  Awumbuk: 'the empty, heavy air after company leaves', Chrysalism: 'the calm of being sheltered indoors while a storm goes on outside', Fernweh: 'an ache for faraway places he has never been',
  Forelsket: 'the euphoria of first falling in love', Gigil: 'the urge to squeeze something unbearably cute', Iktsuarpok: 'going to look again and again to see if someone is coming',
  Kenopsia: 'the eerie hush of a place that should be full of people', "L'appel du vide": 'the strange pull of the edge, the call of the void', Litost: 'a sudden, sharp sight of his own misery',
  'Mono no aware': 'a gentle sadness at how everything passes', Monachopsis: 'the feeling of being out of place, like he no longer fits', Onism: 'knowing how little of the world he will ever see',
  Saudade: 'longing for something loved and lost that may never return', Sonder: 'the realisation that every other person has a life as vivid as his', Toska: 'a spiritual anguish with no single cause',
  Schadenfreude: 'a guilty pleasure at someone else\'s bad luck', Weltschmerz: 'world-weariness; sorrow that the world is not as it should be', Anhedonia: 'nothing gives pleasure any more',
  Limerent: 'consumed by longing to be loved back', Ennui: 'a listless, aching boredom', Halcyon: 'a memory of calmer, happier days', Aligned: 'everything inside him pointing the same way',
  Catatonic: 'locked still, unresponsive', Bucolic: 'the simple peace of fields and work', Quixotic: 'hopeful beyond all reason', Psychic: 'sensing presences that are not there',
  Voyeuristic: 'the sense of being watched like a specimen',
};
const LEX = [];
for (const line of LEXICON.trim().split('\n')) {
  const [fam, ...rest] = line.split(':');
  const parts = rest.join(':').split('|');
  for (const part of parts) { const i = part.indexOf(':'); const band = +part.slice(0, i); for (const w of part.slice(i + 1).split(',')) if (w && !LEX.some(x => x.w === w)) LEX.push({ w, fam, band }); }
}
LEX.sort((a, b) => a.w.localeCompare(b.w));
const FAM_COL = { fear: '#c4321f', panic: '#c4321f', anxiety: '#a8692a', dread: '#6a4f9c', anger: '#c4321f', irritable: '#a8692a', aggress: '#8a1f14', cruel: '#16181b', vengeful: '#8a1f14', defiant: '#a8692a',
  sad: '#2b6684', grief: '#16181b', despair: '#16181b', doom: '#16181b', defeat: '#5b6168', disappoint: '#5b6168', lonely: '#2b6684', isolated: '#2b6684', abandon: '#2b6684', heartbreak: '#a33a5a', longing: '#a33a5a', nostalgia: '#a8692a',
  shame: '#a8692a', guilt: '#6a4f9c', embarrass: '#a8692a', disgust: '#5d6f3a', contempt: '#5b6168', envy: '#5d6f3a', jealous: '#5d6f3a', bored: '#5b6168', apathy: '#5b6168', numb: '#5b6168',
  love: '#c2416b', affection: '#c2416b', tender: '#c2416b', care: '#c2416b', romance: '#c2416b', attract: '#c2416b', lust: '#a3264a', needy: '#a33a5a', connected: '#3d7a4f', protect: '#3d7a4f',
  joy: '#3d7a4f', play: '#3d7a4f', content: '#3d7a4f', calm: '#2b6684', safe: '#3d7a4f', relief: '#3d7a4f', grateful: '#3d7a4f', pride: '#3d7a4f', hope: '#3d7a4f', courage: '#3d7a4f', determ: '#3d7a4f',
  awe: '#2b6684', curious: '#2b6684', contemplate: '#6a4f9c', transcend: '#6a4f9c', haunted: '#6a4f9c', mad: '#6a4f9c', dissoc: '#6a4f9c', paranoid: '#6a4f9c', nihil: '#16181b' };
const famCol = f => FAM_COL[f] || '#5b6168';

// the families, from a state (his S, or a villager's) and a context of where he is and what is happening
function emoFamilies(s, x) {
  const c = v => clamp(v), g = s.grip == null ? 1 : s.grip;
  const desp = c(.45 * (1 - s.hope) + .15 * s.loneliness + .2 * (1 - g) + .2 * (s.grief || 0) + .1 * (s.guilt || 0));
  const need = Math.max(s.hunger || 0, s.thirst || 0, 1 - (s.warmth == null ? 1 : s.warmth), 1 - (s.health == null ? 1 : s.health));
  const ex = s.excite || 0, joy = s.joy || 0, aff = s.affection || 0, att = s.attraction || 0, lust = s.lust || 0, love = s.love || 0, depth = s.depth || 0;
  const apathy = c(desp * (s.boredom || 0) * 1.4), arousal = c(s.fear * .6 + s.anger * .6 + ex * .6 + (s.surprise || 0) * .5);
  const content = c((1 - need) * (.4 + s.hope * .4 + joy * .3) - s.fear * .4 - desp * .5 + (x.company ? .15 : 0));
  return {
    fear: s.fear, panic: c((s.fear - .6) * 2.4), anxiety: c(s.fear * .55 + (s.dread || 0) * .5 + (s.ptsd || 0) * .3 - .12), dread: s.dread || 0,
    anger: s.anger, irritable: c(s.anger * .6 + need * .35 + ((s.sleep || 0) > .6 ? .2 : 0) + (s.boredom || 0) * .2 - .12), aggress: c(s.anger * .8 + (x.fight || 0) * .6 - .15),
    cruel: c(s.anger * (1 - aff) * (1 - g) * 1.2 - .2), vengeful: c(s.anger * .5 + (s.betrayal || 0) * .7 - .15), defiant: c(s.anger * .4 + (x.escape || 0) * .5 + (x.trapped ? .15 : 0) - .1),
    sad: c(Math.max(desp * .8, (s.grief || 0) * .7, s.loneliness * .6) - .05), grief: s.grief || 0, despair: c(desp * 1.15 - .1), doom: c(desp * (s.dread || 0) * 1.6), defeat: c(desp * (1 - (x.escape || .3)) * 1.2 - .1),
    disappoint: c((x.letdown || 0) + desp * .3 - .1), lonely: s.loneliness, isolated: c(s.loneliness * (x.company ? .3 : 1) * (x.trapped || x.alone ? 1.1 : .7)), abandon: c(s.loneliness * (1 - s.hope) * 1.6 - .1),
    heartbreak: s.heartbreak || 0, longing: c(Math.max(s.longing || 0, s.loneliness * love)), nostalgia: s.nostalgia || 0,
    shame: s.shame || 0, guilt: s.guilt || 0, embarrass: c((s.shame || 0) * .5 + (x.company ? (1 - (s.hygiene == null ? 1 : s.hygiene)) * .4 : 0) + att * (x.crushNear ? .45 : 0) - .08), disgust: c((s.disgust || 0) + (1 - (s.hygiene == null ? 1 : s.hygiene)) * .25 - .1),
    contempt: c(s.anger * (s.betrayal || 0) * 1.4 + (x.watched || 0) * s.anger * .5), envy: s.envy || 0, jealous: s.jealousy || 0,
    bored: s.boredom || 0, apathy, numb: c(apathy * .7 + (1 - g) * desp * .5 + (x.catatonic ? 1 : 0) - .1),
    tired: c((s.sleep || 0) * .9 + (1 - (s.energy == null ? 1 : s.energy)) * .4 - .1), rested: c((s.energy == null ? .5 : s.energy) - (s.sleep || 0) - .2) * (x.justWoke ? 1.4 : .7), sated: c((x.justAte || 0) * (1 - (s.hunger || 0))),
    hungry: c(((s.hunger || 0) - .35) * 1.6), thirsty: c(((s.thirst || 0) - .35) * 1.6), cold: c((.75 - (s.warmth == null ? 1 : s.warmth)) * 1.6), cozy: c(((s.warmth == null ? 1 : s.warmth) - .6) * (x.fire || x.indoors ? 1.6 : .3) * (1 - s.fear)),
    sick: c((x.sick || 0) + (s.pain || 0) * .3), weak: c((1 - (s.health == null ? 1 : s.health)) * 1.3 - .25),
    confused: c((1 - g) * .6 + (x.disoriented || 0) - .15), dissoc: c((1 - g) * .9 - .3 + (x.flash || 0) * .4), mad: c((.3 - g) * 3 + (x.drugged || 0)), haunted: c((x.hall || 0) * 1.1 + (s.ptsd || 0) * .3),
    paranoid: c(s.fear * (1 - g) * 1.4 + (x.watched || 0) * .5 - .1), distrust: c((s.betrayal || 0) * .7 + (1 - (s.trust == null ? .6 : s.trust)) * .5 - .15), wary: c(s.fear * .5 + (s.ptsd || 0) * .4 + (x.danger || 0) * .5 - .1),
    trust: c((s.trust == null ? .5 : s.trust) * (x.company ? 1 : .4)), betrayed: s.betrayal || 0, vulnerable: c(s.fear * .4 + (1 - (s.health == null ? 1 : s.health)) * .5 + (x.danger || 0) * .3 - .1),
    powerless: c(desp * .5 + (x.trapped ? .25 : 0) + (x.godHand || 0) * .4 - (x.escape || 0) * .3), submissive: c((x.trapped ? .2 : 0) + (1 - s.anger) * desp * .4 - .2), trapped: x.trapped ? c(.35 + (x.escape || 0) * .3 + s.fear * .3 + (x.small || 0) * .2) : 0,
    overwhelm: c((s.fear + s.anger + desp + need + (s.grief || 0)) / 3 - .2), conflicted: c(Math.min(s.hope, desp) * 1.6 + Math.min(love, s.anger) - .1), doubt: c((1 - g) * .3 + (s.dread || 0) * .3 + (x.unsure || 0) - .1),
    restless: c((s.boredom || 0) * (s.energy == null ? .7 : s.energy) * 1.2 + (x.escape || 0) * .3 - .1), anticip: c((x.expecting || 0) + ex * .4), excite: c(ex + arousal * .2 * s.hope - .05),
    joy: c(joy), play: c(joy * .7 + (x.company ? .2 : 0) - s.fear * .4 - desp * .3), content, calm: c(1 - arousal - desp * .5 - need * .5 + depth * .3 - .15), safe: c((x.indoors || x.fire || x.company ? .5 : .1) + (1 - s.fear) * .4 - (x.danger || 0) - .2),
    relief: s.relief || 0, grateful: c((s.gratitude || 0) + (x.justAte || 0) * .2), pride: s.pride || 0, dom: c((s.pride || 0) * .5 + (1 - s.fear) * .3 + (x.won || 0) - .2), courage: c((x.danger || x.fight ? .4 : 0) + (1 - s.fear) * .3 + s.anger * .2 - .1),
    determ: c((x.escape || 0) * .7 + (x.purpose || 0) * .5 + s.hope * .2 - desp * .2), stoic: c((1 - arousal) * need * 1.2 + depth * .3 - desp * .3), hope: s.hope,
    love, affection: aff, tender: c((s.tenderness || 0) + (x.child || 0) * .6), care: c(aff * .5 + (s.tenderness || 0) * .5 + (x.company ? .15 : 0)), romance: c(love * att * 1.2 + (x.partnerNear ? .3 : 0)), attract: att, lust,
    needy: c(s.loneliness * love * 1.3), connected: c((x.company ? .45 : 0) + aff * .4 + (x.partnerNear ? .3 : 0)), protect: c(((x.child || 0) + (x.company ? .4 : 0)) * ((x.danger || 0) + .3)),
    curious: s.curiosity || 0, analytic: c(g * (s.curiosity || 0) * (1 - arousal) * 1.2 - .1), awe: s.awe || 0, surprise: s.surprise || 0, shock: c((s.surprise || 0) * (s.fear + (s.grief || 0)) * 1.5),
    contemplate: c(depth * 1.1 + (x.alone ? .1 : 0)), brood: c(desp * (1 - depth) * .7 + (s.guilt || 0) * .3 - .1), morbid: c((x.dead || 0) * (s.curiosity || 0) * 1.5), nihil: c(desp * depth * 1.8),
    transcend: c((depth - .55) * 2.2), wander: c((x.freedom || 0) * ((s.boredom || 0) + .3)), feral: c((1 - g) * (x.hunt || 0) * 2 + (1 - (s.hygiene == null ? 1 : s.hygiene)) * (1 - g) * .5 - .1),
    crave: c(Math.max((s.hunger || 0) - .5, (x.crave || 0)) * 1.4), obsess: c((x.obsess || 0) + (s.longing || 0) * (1 - g) * .8), volatile: c(Math.min(s.anger, s.fear) * 2 + (1 - g) * .2 - .1),
    solemn: c((x.dead || 0) * .6 + (s.grief || 0) * (1 - s.anger) * .5), quixotic: c((s.hope - .6) * (1 - g) * 4),
  };
}
// the situational words, each with its own trigger
function emoSpecials(s, x) {
  const g = s.grip == null ? 1 : s.grip;
  return {
    Awumbuk: x.leftRecently || 0, Chrysalism: x.storm && x.indoors ? .8 : 0, Fernweh: clamp((x.freedom || 0) * (x.trapped || x.homebound ? .9 : .3) - .1),
    Forelsket: clamp((s.attraction || 0) * (s.joy || 0) * 2 * (x.newLove || 0)), Gigil: x.cute || 0, Iktsuarpok: x.expecting || 0, Kenopsia: x.emptyPlace || 0,
    "L'appel du vide": clamp((x.edge || 0) * (1 - g) * 1.5), Litost: x.litost || 0, 'Mono no aware': clamp((x.impermanence || 0) * ((s.depth || 0) + .3)), Monachopsis: x.outOfPlace || 0,
    Onism: clamp((s.depth || 0) * (x.freedom || 0) * (x.trapped ? 1.2 : .5)), Saudade: clamp((s.longing || 0) * (s.grief || 0) * 2 + (s.nostalgia || 0) * (x.lostHome || 0)), Sonder: x.sonder || 0,
    Toska: clamp(((s.dread || 0) + (1 - s.hope)) / 2 * (s.depth || 0) * 1.5), Schadenfreude: x.schaden || 0, Aligned: clamp(s.hope * (s.depth || 0) * g * 1.8 - .3), Dynamic: 0,
  };
}
// every word's intensity right now
function emoWords(s, x) {
  const F = emoFamilies(s, x), SP = emoSpecials(s, x), out = [];
  for (const e of LEX) {
    let v;
    if (e.fam === 'special') v = SP[e.w] || 0;
    else { const f = F[e.fam] || 0, lo = [0, .12, .38, .66][e.band], hi = [0, .55, .85, 1.01][e.band]; v = f < lo ? 0 : f > hi ? f * .55 : f * (.75 + .25 * (1 - Math.abs((f - (lo + hi) / 2) / ((hi - lo) / 2)))); }
    out.push({ w: e.w, fam: e.fam, band: e.band, v: clamp(v) });
  }
  return out;
}
// the strongest few, one per family so the list reads as different feelings, not synonyms
function topFeelings(words, n = 12) {
  const seen = new Set(), out = [];
  for (const e of words.slice().sort((a, b) => b.v - a.v)) { if (e.v < .1) break; const k = e.fam === 'special' ? e.w : e.fam; if (seen.has(k)) continue; seen.add(k); out.push(e); if (out.length >= n) break; }
  return out;
}
