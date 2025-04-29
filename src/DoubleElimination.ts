import { Match } from './Match.js';
import { shuffle } from './Shuffle.js';

export function DoubleElimination(
  players,
  startingRound = 1,
  ordered = false
) {
  const matches = [];

  // 1) Build player array
  let playerArray;
  if (Array.isArray(players)) {
    playerArray = ordered ? [...players] : shuffle([...players]);
  } else {
    playerArray = Array.from({ length: players }, (_, i) => i + 1);
  }

  const N = playerArray.length;
  const exponent = Math.log2(N);
  const floorExp = Math.floor(exponent);
  const ceilExp = Math.ceil(exponent);
  // remainder = number of “byes”
  const remainder = N - 2 ** floorExp;

  // 2) Build seeding bracket
  const bracket = [1, 4, 2, 3];
  for (let i = 3; i <= floorExp; i++) {
    for (let j = 0; j < bracket.length; j += 2) {
      bracket.splice(j + 1, 0, 2 ** i + 1 - bracket[j]);
    }
  }

  // 3) Helper: turn a seed index into a player or null
  const seed = idx =>
    idx >= 1 && idx <= N ? playerArray[idx - 1] : null;

  let round = startingRound;

  // 4) Initial “bye” round if needed
  if (remainder !== 0) {
    for (let i = 0; i < remainder; i++) {
      matches.push({ round, match: i + 1, player1: null, player2: null });
    }
    round++;
  }

  // 5) Winners bracket skeleton + win-pointers
  let matchExp = floorExp - 1;
  let iterated = false;
  do {
    for (let i = 0; i < 2 ** matchExp; i++) {
      matches.push({ round, match: i + 1, player1: null, player2: null });
    }
    if (iterated) {
      matches
        .filter(m => m.round === round - 1)
        .forEach(m => {
          m.win = { round: round, match: Math.ceil(m.match / 2) };
        });
    } else {
      iterated = true;
    }
    round++;
    matchExp--;
  } while (round < startingRound + ceilExp);

  // 6) Seed the main‐bracket
  const startRound = startingRound + (remainder === 0 ? 0 : 1);
  matches
    .filter(m => m.round === startRound)
    .forEach((m, i) => {
      m.player1 = seed(bracket[2 * i]);
      m.player2 = seed(bracket[2 * i + 1]);
    });

  // 7) Feed byes into those initial matches
  if (remainder !== 0) {
    const initial = matches.filter(m => m.round === startingRound);
    let ctr = 0;
    matches
      .filter(m => m.round === startingRound + 1)
      .forEach(m => {
        const idx1 = playerArray.indexOf(m.player1);
        const idx2 = playerArray.indexOf(m.player2);

        if (idx1 >= 2 ** floorExp - remainder) {
          const im = initial[ctr++];
          im.player1 = m.player1;
          im.player2 = seed(2 ** ceilExp - idx1);
          im.win = { round: startingRound + 1, match: m.match };
          m.player1 = null;
        }
        if (idx2 >= 2 ** floorExp - remainder) {
          const im = initial[ctr++];
          im.player1 = m.player2;
          im.player2 = seed(2 ** ceilExp - idx2);
          im.win = { round: startingRound + 1, match: m.match };
          m.player2 = null;
        }
      });
  }

  // 8) Winners-bracket final
  matches.push({ round, match: 1, player1: null, player2: null });
  const prevFinal = matches.find(m => m.round === round - 1);
  if (prevFinal) {
    prevFinal.win = { round, match: 1 };
  }
  round++;
  const roundDiff = round - 1;

  // 9) Losers bracket “prefill” if there were byes
  if (remainder !== 0) {
    // small‐remainder case
    if (remainder <= 2 ** (floorExp - 1)) {
      for (let i = 0; i < remainder; i++) {
        matches.push({ round, match: i + 1, player1: null, player2: null });
      }
      round++;
    } else {
      // large‐remainder case
      for (let i = 0; i < remainder - 2 ** (floorExp - 1); i++) {
        matches.push({ round, match: i + 1, player1: null, player2: null });
      }
      round++;
      for (let i = 0; i < 2 ** (floorExp - 1); i++) {
        matches.push({ round, match: i + 1, player1: null, player2: null });
      }
      round++;
    }
  }

  // 10) Build the rest of the losers‐bracket structure
  let loserExp = floorExp - 2;
  do {
    for (let side = 0; side < 2; side++) {
      for (let j = 0; j < 2 ** loserExp; j++) {
        matches.push({ round, match: j + 1, player1: null, player2: null });
      }
      round++;
    }
    loserExp--;
  } while (loserExp > -1);

  // 11) Routing helper for linking win/loss pointers
  const fillPattern = (count, fc) => {
    const arr = Array.from({ length: count }, (_, i) => i + 1);
    const c = fc % 4;
    const half = count / 2;
    const first = arr.slice(0, half);
    const second = arr.slice(half);
    if (c === 0) return arr;
    if (c === 1) return arr.reverse();
    if (c === 2) return first.reverse().concat(second.reverse());
    return second.concat(first);
  };

  // 12) Cross‐link winners & losers
  let fillCount = 0;
  let winRound = startingRound;
  let loseRound = roundDiff + 1;

  // perfect power‐of‐2
  if (remainder === 0) {
    let wb = matches.filter(m => m.round === winRound);
    const fp = fillPattern(wb.length, fillCount++);
    matches
      .filter(m => m.round === loseRound)
      .forEach(lm => {
        for (let i = 0; i < 2; i++) {
          const tgt = wb.find(wm => wm.match === fp.shift());
          if (tgt) tgt.loss = { round: lm.round, match: lm.match };
        }
      });
    winRound++;
    loseRound++;
  }
  // small‐remainder case
  else if (remainder <= 2 ** (floorExp - 1)) {
    let wb = matches.filter(m => m.round === winRound);
    let fp = fillPattern(wb.length, fillCount++);
    matches
      .filter(m => m.round === loseRound)
      .forEach((lm, i) => {
        const tgt = wb.find(wm => wm.match === fp[i]);
        if (tgt) tgt.loss = { round: lm.round, match: lm.match };
      });
    winRound++;
    loseRound++;

    wb = matches.filter(m => m.round === winRound);
    fp = fillPattern(wb.length, fillCount++);
    // find byes in round-2
    const byeRoutes = new Set(
      matches
        .filter(
          m =>
            m.round === startingRound + 1 &&
            (m.player1 === null || m.player2 === null)
        )
        .map(m => Math.ceil(m.match / 2))
    );
    let alt = 0;
    matches
      .filter(m => m.round === loseRound)
      .forEach(lm => {
        for (let i = 0; i < 2; i++) {
          const tgt = wb.find(wm => wm.match === fp.shift());
          if (tgt) {
            if (byeRoutes.has(lm.match)) {
              const prevLM = matches.filter(x => x.round === loseRound - 1)[alt++];
              tgt.loss = {
                round: prevLM.round,
                match: prevLM.match
              };
              byeRoutes.delete(lm.match);
            } else {
              tgt.loss = { round: lm.round, match: lm.match };
            }
          }
        }
      });
    winRound++;
    loseRound++;

    // link back into winners
    const roundTwoRoutes = Array.from(
      matches
        .filter(
          m =>
            m.round === startingRound + 1 &&
            (m.player1 === null || m.player2 === null)
        )
        .map(m => Math.ceil(m.match / 2))
    );
    matches
      .filter(m => m.round === roundDiff + 1)
      .forEach((m, i) => {
        const nm = matches.find(
          x => x.round === m.round + 1 && x.match === roundTwoRoutes[i]
        );
        if (nm) m.win = { round: nm.round, match: nm.match };
      });
  }
  // large‐remainder case
  else {
    const wb = matches.filter(m => m.round === winRound);
    const lbA = matches.filter(m => m.round === loseRound);
    loseRound++;
    const lbB = matches.filter(m => m.round === loseRound);

    const fp = fillPattern(wb.length, fillCount++);
    const byeRoutes = new Set(
      matches
        .filter(
          m =>
            m.round === startingRound + 1 &&
            m.player1 === null &&
            m.player2 === null
        )
        .map(m => m.match)
    );

    let aI = 0,
      bI = 0;
    lbB.forEach(lb => {
      const wA = wb.find(wm => wm.match === fp[aI++]);
      if (!wA) return;
      if (byeRoutes.has(lb.match)) {
        const lossM = lbA[bI++];
        wA.loss = { round: lossM.round, match: lossM.match };
        const wB = wb.find(wm => wm.match === fp[aI++]);
        if (wB) wB.loss = { round: lossM.round, match: lossM.match };
      } else {
        wA.loss = { round: lb.round, match: lb.match };
      }
    });
    winRound++;

    const br = Array.from(byeRoutes);
    matches
      .filter(m => m.round === roundDiff + 1)
      .forEach((m, i) => {
        const nm = matches.find(x => x.round === m.round + 1 && x.match === br[i]);
        if (nm) m.win = { round: nm.round, match: nm.match };
      });
  }

  // 13) Finish cross‐links
  let ff = 0;
  for (let r = winRound; r < roundDiff; r++) {
    let lA = matches.filter(
      m => m.round === loseRound - winRound + ff + r
    );
    const lB = matches.filter(
      m => m.round === loseRound - winRound + ff + r + 1
    );
    if (lA.length === lB.length) {
      lA = lB;
      ff++;
    }
    const wM = matches.filter(m => m.round === r);
    const fp = fillPattern(wM.length, fillCount++);
    lA.forEach((lm, j) => {
      const tgt = wM.find(wm => wm.match === fp[j]);
      if (tgt) tgt.loss = { round: lm.round, match: lm.match };
    });
  }

  // 14) Final pointers
  const maxR = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  for (
    let r = remainder === 0 ? roundDiff + 1 : roundDiff + 2;
    r < maxR;
    r++
  ) {
    const lA = matches.filter(m => m.round === r);
    const lB = matches.filter(m => m.round === r + 1);
    lA.forEach((lm, j) => {
      const nm =
        lA.length === lB.length ? lB[j] : lB[Math.floor(j / 2)];
      if (nm) lm.win = { round: nm.round, match: nm.match };
    });
  }

  // 15) Championship linkage
  const finalM = matches.find(m => m.round === maxR);
  if (finalM) {
    finalM.win = { round: roundDiff, match: 1 };
  }

  return matches;
}
