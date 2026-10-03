/**
 * Turns a PartyView into the lines a roommate panel shows. Pure, so it can be
 * tested for leaks: a line mentions another party's value only if that value
 * is in the view, and the view only holds what was delivered (driver tests).
 * Tolerates fields added by later rungs (shares, reconstruction, exclusion).
 */
import { PARTY_IDS, type PartyId, type PartyView } from '../protocol/types';
import { commitmentLabel, name, phaseLabel, roomLabel, shortBytes, shortScalar, totalLabel } from './format';
import { mathMode } from './mathMode';

export interface Fact {
  label: string;
  value: string;
  /** 'self' = about me, 'secret' = my private data, 'public' = learned from others, 'alert' = problem */
  kind: 'self' | 'secret' | 'public' | 'alert';
}

type Loose = PartyView & Record<string, unknown>;

function isScalar(x: unknown): x is bigint { return typeof x === 'bigint'; }
function isBytes(x: unknown): x is Uint8Array { return x instanceof Uint8Array; }

function perParty(rec: unknown, me: PartyId, fmt: (v: unknown) => string | null): string[] {
  if (!rec || typeof rec !== 'object') return [];
  const out: string[] = [];
  for (const p of PARTY_IDS) {
    if (p === me) continue;
    const v = (rec as Record<number, unknown>)[p];
    if (v === undefined) continue;
    const s = fmt(v);
    if (s !== null) out.push(`${name(p)}: ${s}`);
  }
  return out;
}

export function panelFacts(view: PartyView, me: PartyId): Fact[] {
  const v = view as Loose;
  const facts: Fact[] = [];

  const crypto = mathMode.get();
  if (isScalar(v.myValue)) facts.push({ label: 'My number', value: shortScalar(v.myValue), kind: 'secret' });
  if (crypto && isBytes(v.myNonce) && v.myNonce.length > 0) facts.push({ label: 'My nonce', value: shortBytes(v.myNonce), kind: 'secret' });

  if (crypto) {
    const commits = perParty(v.commitments, me, (c) => (isBytes(c) ? commitmentLabel(c) : Array.isArray(c) ? `${c.length} points` : null));
    if (commits.length) facts.push({ label: 'Commitments seen', value: commits.join(' · '), kind: 'public' });
  } else {
    const sealed = PARTY_IDS.filter((p) => p !== me && (v.commitments as Record<number, unknown>)[p] !== undefined).map(name);
    if (sealed.length) facts.push({ label: 'Sealed numbers from', value: sealed.join(', '), kind: 'public' });
  }

  const announced = perParty(v.announced, me, (s) => (isScalar(s) ? shortScalar(s) : null));
  if (announced.length) facts.push({ label: 'Heard', value: announced.join(' · '), kind: 'public' });

  const revealed = perParty(v.revealed, me, (s) => (isScalar(s) ? shortScalar(s) : null));
  if (revealed.length) facts.push({ label: 'Revealed to me', value: revealed.join(' · '), kind: 'public' });

  // Fields from later rungs, rendered generically if present.
  if (Array.isArray(v.sharesHeld) && v.sharesHeld.length) {
    const held = v.sharesHeld as Array<{ dealer?: PartyId; x?: number; y?: bigint }>;
    if (crypto) {
      const parts = held.filter((s) => s && s.dealer !== undefined).map((s) => `${name(s.dealer!)}: ${isScalar(s.y) ? shortHex(s.y) : '?'}`);
      facts.push({ label: 'Shares held', value: parts.join(' · '), kind: 'secret' });
    } else {
      const from = new Set<string>();
      for (const s of held) if (s && s.dealer !== undefined) from.add(name(s.dealer));
      facts.push({ label: 'Shares held', value: `${held.length}${from.size ? ` (one each from ${[...from].join(', ')})` : ''}`, kind: 'secret' });
    }
  }
  const reconstructed = perParty(v.reconstructed, me, (s) => (isScalar(s) ? shortScalar(s) : null));
  if (reconstructed.length) facts.push({ label: 'Reconstructed', value: reconstructed.join(' · '), kind: 'public' });
  for (const key of ['complaints', 'disqualified', 'rejected', 'excluded'] as const) {
    const arr = v[key];
    if (Array.isArray(arr) && arr.length) {
      facts.push({ label: key[0]!.toUpperCase() + key.slice(1), value: (arr as PartyId[]).map(name).join(', '), kind: 'alert' });
    }
  }
  if (Array.isArray(v.invalid) && v.invalid.length) {
    facts.push({ label: 'Bad reveals', value: v.invalid.map(name).join(', '), kind: 'alert' });
  }

  if (isScalar(v.combined) && typeof v.arrangement === 'number') {
    facts.push({ label: 'Total', value: totalLabel(v.combined, v.arrangement), kind: 'public' });
  }
  if (v.assignment) {
    const a = v.assignment as Record<PartyId, string>;
    facts.push({ label: 'My room', value: roomLabel(a[me]), kind: 'self' });
    facts.push({
      label: 'Everyone',
      value: PARTY_IDS.filter((p) => p !== me).map((p) => `${name(p)}: ${roomLabel(a[p])}`).join(' · '),
      kind: 'public',
    });
  }
  return facts;
}

/** Short hex of a field element, for share values when the cryptography is shown. */
function shortHex(s: bigint): string {
  return `${s.toString(16).padStart(64, '0').slice(0, 6)}…`;
}

export function panelPhase(view: PartyView): string {
  return phaseLabel(view.phase);
}
