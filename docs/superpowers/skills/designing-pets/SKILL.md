---
name: designing-pets
description: Use when designing a new pet, reworking an existing pet's mechanics, or evaluating whether a proposed pet change preserves strategic depth + fun. The pet roster's job is to make the game interesting; this skill keeps proposals honest.
---

# Designing Pets for Pet Painters

## Overview

Pets are the game's expressive surface. Every pet should answer: **"What new decision does this create for the player?"** If it doesn't, it shouldn't ship.

The ranking of design considerations:

1. **Strategic depth** — does the pet enable real choices, real counterplay, real comp-building?
2. **Fun** — is using it satisfying? Does it create memorable moments?
3. **Synergy potential** — does it combo with other pets to unlock comps?
4. **Theme** — does the mechanic match what the animal "feels like"?

Theme is last for a reason. A thematically perfect pet that doesn't add strategic depth is a worse pet than a mechanically interesting one with a slightly forced theme.

## The Pet Pitch Template

When proposing any new pet OR a non-trivial rework, fill this out FIRST. If you can't fill it out cleanly, the design isn't ready.

```
NAME: ____________________
EMOJI: ____________________
SIZE: __×__
ROLE TAG: [painter | fighter | support | disruptor | hybrid:X+Y]

ONE-LINE IDENTITY:
  "This pet is the one that ______."
  (If you can't finish this sentence in 10 words, the identity isn't sharp enough.)

CORE DECISION IT CREATES:
  When the player picks this pet, what new strategic question do they ask?
  ("When do I deploy?" / "Where do I face it?" / "Do I save up for it?")

STATS:
  cost: __ | speed: __ | hp: __ | atk: __ | weight: __ | atk-speed: __

PRIMARY ABILITY:
  (What's special about it. Trigger + action.)

WHAT IT'S GOOD AT:
  (1-2 concrete situations: "great against swarms", "stalls fronts", etc.)

WHAT IT'S WEAK TO:
  (Must have at least ONE clear counter. If it has no weakness, it's overpowered.)

SYNERGY WITH:
  (At least 1-2 existing pets it pairs well with, and why.)

WHY IT BELONGS IN THE ROSTER:
  (What gap does it fill? "We don't have a flying healer", "We need a soft Mouse counter that isn't Cat", etc.)

EXPECTED COST/IMPACT:
  (LoC, 2×2 vs 1×1 footprint, new keyword, new behavior.)
```

A good pitch fits on one screen. If yours doesn't, simplify.

## The 5 design principles

### 1. One clear identity, not five vague mechanics

A pet with one strong identity is more interesting than a pet with three weak ones. Mouse swarms. Bear tanks. Spider freezes. Each is one thing, done well.

**Anti-pattern**: "Owl is a flying ranged attacker that also boosts allies and gains hp from kills." That's three pets. Pick one.

### 2. Every pet must enable a NEW decision

A new pet that makes the game feel different = good. A new pet that's just "Mouse but slower" = bad.

The "new decision" might be:
- A new comp archetype ("pair X with Y for an Aggro deck")
- A new counter-deploy ("when opponent has Mouse, drop Cat")
- A new positional puzzle ("place this in the center to control 4 directions")
- A new tempo question ("save energy 3 rounds for this expensive pet?")

If the new decision is just "do I include this in my comp?" — that's not enough. Every pet must answer that question. The new decision must be game-during.

### 3. Counterplay is mandatory

If a pet has no clear weakness, it dominates the meta and ships broken. Build the counter at the same time you build the pet.

For every new pet, write down: "This pet loses to X because Y." If you can't, add a weakness to the design.

Common weakness levers:
- Fragile to AoE (good vs single enemies, bad vs swarms)
- Slow (good if not threatened, bad if pressured)
- Expensive (good if deployed, bad if your opponent rushes you before you can afford it)
- Mechanically conditional (e.g., requires adjacent allies — vulnerable when isolated)
- Direction-locked (e.g., only attacks in front — vulnerable to flank)

### 4. Synergy > raw power

A pet that's 65% solo and 80% in the right comp is more interesting than one that's 75% in every comp. The first creates comp-building strategy; the second creates "always include this."

Bear is a good warning sign: it's at 54% meta appearance because it's a "mandatory glue" pet that fits everywhere. That limits comp diversity. Avoid designing more pets like that.

**Design for synergy**: when proposing a new pet, identify 1-2 specific existing pets it should pair well with, and 1-2 it should NOT pair well with. The "should not" half is what creates comp differentiation.

### 5. Theme reinforces mechanics

Theme is last in priority but it matters. Players reach for what feels right.

- 🐱 Cat as Mouse counter = perfect theme alignment
- 🦏 Rhino with momentum charging = perfect theme
- 🦨 Skunk that freezes via spray = thematic
- 🐭 Mouse that builds nuclear weapons = thematically dissonant

When mechanics and theme align, players intuit the pet's role without reading documentation. That's huge for first-game feel.

## Anti-patterns

**❌ "Just like X but bigger/smaller"**: a clone with adjusted numbers. No new decision.

**❌ "Has 4 different abilities"**: identity diffusion. Players can't predict what it does.

**❌ "Hard counter with no counterplay"**: e.g., a pet that one-shots everything 1×1. Removes strategic choice.

**❌ "Conditional on extremely rare game state"**: e.g., "gains +5 atk if a 3×3 enemy is adjacent and your hp is below 25%." Will never fire in practice.

**❌ "Pet that buffs itself"**: self-synergy doesn't enable new comps. Cross-pet synergy does.

**❌ "Counter to its own role"**: a "fighter that's good at painting" dilutes both roles. Pets should have one role, not two.

## Workflow: how to add a pet

1. **Identify the gap**: read the current meta tier list. What's missing? Is there a Dead pet (rework it), a comp archetype that's missing (design for it), a dominant pet that needs a counter (build the counter)?

2. **Write the pitch** (template above).

3. **Walk through anti-patterns**: does your pitch trigger any? If yes, revise.

4. **Implement minimally**: stats + 1-2 tuples. Don't over-engineer the ability. If the ability needs custom code in `behaviors.ts`, factor it cleanly.

5. **Test in the sim**: run `npm run balance`. Look at where the new pet lands. Aim for **20-50% meta appearance** for a new pet — high enough to matter, low enough to leave room for other comps.

6. **Iterate**: if it's at 80%, nerf its cost or a stat. If at 0%, buff cost or check that its trigger is firing.

7. **Update theme/description**: write the `ui.ability` text so a new player understands what it does in one sentence.

## Workflow: how to rework an existing pet

Apply when a pet has been Dead/Fringe across 2+ balance rounds despite stat changes.

1. **Diagnose**: read its current code carefully. Is the trigger firing? Is the action effective? Is it dying before it can act?

2. **Decide if the IDENTITY is broken or just the NUMBERS**:
   - Numbers broken → cost/stat change (use the balance iteration loop)
   - Identity broken → rework

3. **Identity rework**: don't replace the whole pet. Keep the theme, change ONE thing about the mechanic. E.g., Spider as "stationary freeze denier" → "moving freeze denier with a slower base move."

4. **Write the new pitch** as if it's a new pet, with the diagnosis included.

5. **Implement, test in sim, iterate.**

## Quick reference: pet roles

| Role | Job | Examples |
|---|---|---|
| **Painter** | Convert tiles fast | Mouse, Rabbit, Whale |
| **Fighter** | Kill enemy pets | Bear, Lion, Rhino |
| **Support** | Buff/heal/control allies | (currently missing — design opportunity) |
| **Disruptor** | Freeze/stun/displace enemies | Skunk, Spider |
| **Hybrid** | Two roles in one pet | Dragon (paint denier + fighter), Cat (fighter + soft painter) |

The roster currently has a clear support gap. A pet that purely buffs adjacent allies (e.g., "all adjacent friends move 50% faster") would create new comp archetypes that don't currently exist.

## Real-world reference: the current roster

For each pet, what's its identity in one phrase:

- 🐭 Mouse: cheap swarm painter
- 🐱 Cat: anti-mouse jumper
- 🐰 Rabbit: fast scout (currently Dead — identity unclear)
- 🐢 Turtle: slow heavy painter
- 🦨 Skunk: omnidirectional freezer
- 🦁 Lion: snowballing kill-streak fighter
- 🕷️ Spider: stationary web denier
- 🦅 Eagle: flying anti-small picker
- 🐻 Bear: rage-tank fighter (current "glue" pet)
- 🦏 Rhino: weight-pushing brawler
- 🐉 Dragon: cone-fire AoE caster
- 🐳 Whale: 3×3 tank painter
- 🐘 Elephant: 2×2 pusher-painter

Rabbit is the clearest rework target (no identity, 0% meta). The missing role is pure SUPPORT — no pet currently exists to buff allies.

## Stop conditions

A pet design is DONE when:
- ✅ Identity is one sentence
- ✅ One concrete clear counter exists
- ✅ It synergizes with at least 1 existing pet specifically
- ✅ It sits in 20-50% meta appearance after 1-2 balance rounds
- ✅ Its ability description is understandable in 5 seconds

If any are missing, keep iterating.
