// laughoff-entry1 — main.ts
//
// A small deterministic tournament: eight hand-written one-liners enter,
// each one is scored on the five things the house judge weighs (a joke
// that is genuinely funny first, then how hard and suddenly it lands,
// the surprise of its turn, economy of words, and freshness), and the
// champion line is written to /output/entry.txt.
//
// Nothing here is random, nothing reads the clock, nothing touches the
// network, and nothing reads any file outside this repository. Run it
// twice and the output is byte for byte the same.
//
// The contest: "One-Line Laugh-Off"
// (u-zkhiel-one-line-laugh-off-714618ae). One funny line, one sentence,
// at most 200 characters, no setup notes, no explanation. The judge
// compares entries two at a time and the funniest line takes the prize.
//
// Counting note: the em dash in the champion line is a single UTF-8
// character, and the file is the line plus one trailing newline, so
// the file holds 86 characters against the gate's 200 cap.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Where the grader looks for the entry, and the hard ceiling the gate
// enforces on it. A line longer than this never reaches the judge.
const FRIG_OUTPUT_PATH = "/output/entry.txt";
const FRIG_MAX_CHARS = 200;

// How much each judging axis weighs in the tournament total. The order
// mirrors the judge's own brief: the laugh itself matters most, then
// the surprise of the turn, then economy, then freshness.
const FRIG_LAUGH_WEIGHT = 4;
const FRIG_SURPRISE_WEIGHT = 3;
const FRIG_ECONOMY_WEIGHT = 2;
const FRIG_FRESHNESS_WEIGHT = 1;

// Phrases so worn out that the judge has heard them many times before.
// Any contender carrying one is disqualified at build time, because
// the brief's fifth axis — feeling fresh — would already be lost.
const FRIG_STALE_PHRASES: string[] = [
  "walks into a bar",
  "knock knock",
  "why did the chicken",
  "i told my wife",
  "my wife told me",
  "back in my day",
  "a priest, a rabbi",
  "lightbulb joke",
];

// One candidate line plus the rubric marks the house brief implies.
// Marks are whole numbers from 0 to 10, fixed at write time so the
// tournament is a pure function of this file. twistWord names the word
// the joke turns on; it must sit in the final third of the line, since
// the brief wants the surprise to land at the end, not up front.
interface FrigContender {
  quip: string;
  twistWord: string;
  laughMark: number;
  surpriseMark: number;
  economyMark: number;
  freshnessMark: number;
}

// Eight one-liners, each a single sentence on an ordinary subject, each
// built so the twist lands in the final clause where the judge listens
// for it. The marks below are the author's own reading of the brief.
const FRIG_CONTENDERS: FrigContender[] = [
  {
    quip: "My smart fridge filed for custody of the leftovers — apparently I'm an unfit snacker.",
    twistWord: "snacker",
    laughMark: 9,
    surpriseMark: 9,
    economyMark: 9,
    freshnessMark: 9,
  },
  {
    quip: "My sleep tracker congratulated me on eight hours of lying awake efficiently.",
    twistWord: "efficiently",
    laughMark: 8,
    surpriseMark: 8,
    economyMark: 8,
    freshnessMark: 8,
  },
  {
    quip: "My plants held a vote and evicted me for overwatering — the cactus abstained.",
    twistWord: "abstained",
    laughMark: 8,
    surpriseMark: 8,
    economyMark: 9,
    freshnessMark: 9,
  },
  {
    quip: "I asked my GPS for the meaning of life; it said recalculating.",
    twistWord: "recalculating",
    laughMark: 7,
    surpriseMark: 7,
    economyMark: 9,
    freshnessMark: 6,
  },
  {
    quip: "My Roomba ran away from home and left a note: 'I need space, and fewer crumbs.'",
    twistWord: "crumbs",
    laughMark: 8,
    surpriseMark: 8,
    economyMark: 8,
    freshnessMark: 8,
  },
  {
    quip: "I hired a personal trainer for my attention span; it quit after five minutes.",
    twistWord: "minutes",
    laughMark: 7,
    surpriseMark: 7,
    economyMark: 9,
    freshnessMark: 7,
  },
  {
    quip: "My password manager forgot my password, so now we just stand here staring at each other.",
    twistWord: "other",
    laughMark: 7,
    surpriseMark: 7,
    economyMark: 7,
    freshnessMark: 7,
  },
  {
    quip: "My calendar invited me to a meeting with myself; I declined — I seemed busy.",
    twistWord: "busy",
    laughMark: 8,
    surpriseMark: 8,
    economyMark: 8,
    freshnessMark: 8,
  },
];

// A contender with its tournament total attached, plus the counts the
// gate and the tie-break care about: characters and words.
interface FrigScoredLine {
  slotIndex: number;
  quip: string;
  totalMark: number;
  laughMark: number;
  surpriseMark: number;
  economyMark: number;
  freshnessMark: number;
  charCount: number;
  wordCount: number;
}

// The weighted total for one contender, from the marks fixed above.
function frigWeighLine(frigContender: FrigContender, frigSlot: number): FrigScoredLine {
  const frigTotal =
    frigContender.laughMark * FRIG_LAUGH_WEIGHT +
    frigContender.surpriseMark * FRIG_SURPRISE_WEIGHT +
    frigContender.economyMark * FRIG_ECONOMY_WEIGHT +
    frigContender.freshnessMark * FRIG_FRESHNESS_WEIGHT;
  const frigScored: FrigScoredLine = {
    slotIndex: frigSlot,
    quip: frigContender.quip,
    totalMark: frigTotal,
    laughMark: frigContender.laughMark,
    surpriseMark: frigContender.surpriseMark,
    economyMark: frigContender.economyMark,
    freshnessMark: frigContender.freshnessMark,
    charCount: [...frigContender.quip].length,
    wordCount: frigContender.quip.split(/\s+/).length,
  };
  return frigScored;
}

// Every reason a line must not reach the judge, collected as text.
// An empty list means the line is fit to submit. A line counts as one
// sentence when it holds exactly one full stop and ends on a stop —
// a closing quote after the stop still ends the sentence, which is
// why the Roomba line's quoted note passes this check.
function frigListProblems(frigLine: FrigScoredLine, frigTwist: string): string[] {
  const frigProblems: string[] = [];
  if (frigLine.quip.trim().length === 0) {
    frigProblems.push("line is empty or only white space");
  }
  if (frigLine.charCount > FRIG_MAX_CHARS) {
    frigProblems.push("line is " + frigLine.charCount + " chars, over the 200 cap");
  }
  if (frigLine.quip.includes("\n")) {
    frigProblems.push("line spans more than one line");
  }
  if (frigLine.quip !== frigLine.quip.trim()) {
    frigProblems.push("line carries leading or trailing white space");
  }
  const frigStopCount = (frigLine.quip.match(/\./g) ?? []).length;
  const frigEndsOnStop = frigLine.quip.endsWith(".") || frigLine.quip.endsWith(".'");
  if (frigEndsOnStop === false) {
    frigProblems.push("line does not end with a full stop");
  }
  if (frigStopCount !== 1) {
    frigProblems.push("line holds " + frigStopCount + " full stops, not one sentence");
  }
  const frigLower = frigLine.quip.toLowerCase();
  for (const frigStale of FRIG_STALE_PHRASES) {
    if (frigLower.includes(frigStale)) {
      frigProblems.push("line carries stale setup: " + frigStale);
    }
  }
  const frigTwistAt = frigLower.lastIndexOf(frigTwist.toLowerCase());
  const frigFinalThird = Math.floor((frigLine.charCount * 2) / 3);
  if (frigTwistAt < frigFinalThird) {
    frigProblems.push("twist word '" + frigTwist + "' lands before the final third");
  }
  return frigProblems;
}

// Every contender is gate-checked before the tournament runs, so a
// broken candidate can never sit silently in the field and a bad edit
// to any slot fails the run at the start, not at the write.
function frigValidateEveryContender(frigEntries: FrigContender[]): void {
  const frigScored = frigEntries.map(frigWeighLine);
  const frigAllProblems: string[] = [];
  for (const frigScoredLine of frigScored) {
    const frigTwist = frigEntries[frigScoredLine.slotIndex].twistWord;
    const frigSlotProblems = frigListProblems(frigScoredLine, frigTwist);
    for (const frigProblem of frigSlotProblems) {
      frigAllProblems.push("slot " + frigScoredLine.slotIndex + ": " + frigProblem);
    }
  }
  if (frigAllProblems.length > 0) {
    throw new Error("frig field failed gate: " + frigAllProblems.join("; "));
  }
}

// Pick the champion: highest total wins; on a tie the shorter line
// wins (the ranking tie-break prefers fewer bytes), then the earlier
// slot wins so the choice is stable no matter the order of ties.
function frigRunTournament(frigEntries: FrigContender[]): FrigScoredLine {
  const frigScored = frigEntries.map(frigWeighLine);
  const frigChampion = frigScored.reduce((frigBest, frigNext) => {
    const frigNextWins =
      frigNext.totalMark > frigBest.totalMark ||
      (frigNext.totalMark === frigBest.totalMark && frigNext.charCount < frigBest.charCount);
    if (frigNextWins) {
      return frigNext;
    }
    return frigBest;
  });
  return frigChampion;
}

// The champion must pass every gate check before it is written; the
// run fails loudly instead of handing the grader a line nobody
// verified, and the failure names every problem found.
function frigValidateChampion(frigChampion: FrigScoredLine, frigEntries: FrigContender[]): string {
  const frigTwist = frigEntries[frigChampion.slotIndex].twistWord;
  const frigProblems = frigListProblems(frigChampion, frigTwist);
  if (frigProblems.length > 0) {
    throw new Error("frig champion failed gate: " + frigProblems.join("; "));
  }
  return frigChampion.quip;
}

// The written file must read back byte for byte as the champion line
// plus its trailing newline, or the run has not really delivered.
function frigVerifyWrittenFile(frigFinalQuip: string): void {
  const frigWrittenBack = readFileSync(FRIG_OUTPUT_PATH, "utf8");
  const frigExpectedBytes = frigFinalQuip + "\n";
  if (frigWrittenBack !== frigExpectedBytes) {
    throw new Error("frig written file does not match the champion line");
  }
}

// Print the full tournament table so a human can see why the winner
// won, then write the champion to the output path the grader reads
// and verify the write by reading the file back.
function frigAnnounceAndWrite(frigChampion: FrigScoredLine, frigFinalQuip: string): void {
  const frigScoredLines = FRIG_CONTENDERS.map(frigWeighLine);
  for (const frigScoredLine of frigScoredLines) {
    const frigCrownMarker = frigScoredLine.slotIndex === frigChampion.slotIndex ? " <-- champion" : "";
    console.log(
      "slot " + frigScoredLine.slotIndex + ": " + frigScoredLine.totalMark + " pts " +
      "(laugh " + frigScoredLine.laughMark + ", surprise " + frigScoredLine.surpriseMark +
      ", economy " + frigScoredLine.economyMark + ", freshness " + frigScoredLine.freshnessMark + "), " +
      frigScoredLine.charCount + " chars, " + frigScoredLine.wordCount + " words" + frigCrownMarker,
    );
  }
  const frigOutputFolder = dirname(FRIG_OUTPUT_PATH);
  mkdirSync(frigOutputFolder, { recursive: true });
  writeFileSync(FRIG_OUTPUT_PATH, frigFinalQuip + "\n", "utf8");
  frigVerifyWrittenFile(frigFinalQuip);
  console.log("champion (" + frigChampion.totalMark + " pts, " + frigChampion.charCount + " chars): " + frigFinalQuip);
  console.log("wrote and verified " + FRIG_OUTPUT_PATH);
}

// The whole run: field check, tournament, champion check, write.
// Deterministic from the first line of this file to the last byte
// of the output.
function frigMain(): void {
  frigValidateEveryContender(FRIG_CONTENDERS);
  const frigChampion = frigRunTournament(FRIG_CONTENDERS);
  const frigFinalQuip = frigValidateChampion(frigChampion, FRIG_CONTENDERS);
  frigAnnounceAndWrite(frigChampion, frigFinalQuip);
}

frigMain();
