import { Aircraft } from "@afd/shared-types";

/** Papel tático — identidade, não tier de poder. */
export type AircraftRole =
  | "air_superiority"
  | "interceptor"
  | "stealth"
  | "multirole"
  | "heavy"
  | "agile"
  | "strike"
  | "recon";

export const AIRCRAFT_ROLE_LABEL: Record<AircraftRole, string> = {
  air_superiority: "Superioridade aérea",
  interceptor: "Interceptador",
  stealth: "Stealth",
  multirole: "Multifunção",
  heavy: "Pesado",
  agile: "Ágil",
  strike: "Ataque",
  recon: "Reconhecimento",
};

/** Atributos arcade 0–100 (fonte de verdade para UI + performance). */
export interface AircraftAttrs {
  speed: number;
  acceleration: number;
  maneuver: number;
  energy: number;
  /** Capacidade de carregar munição (peso). */
  payload: number;
  toughness: number;
  precision: number;
  /** MVP: exibido; radar completo fica para fase seguinte. */
  radar: number;
  /** Assinatura (menor = mais furtivo). */
  rcs: number;
}

export interface AircraftProfile {
  aircraft: Aircraft;
  role: AircraftRole;
  /** Capacidade de carga relativa (soma das massas dos racks). */
  payloadCapacity: number;
  attrs: AircraftAttrs;
  /** Texto curto no visual do hangar. */
  blurb: string;
  strengths: string;
  limitations: string;
}

function p(
  aircraft: Aircraft,
  role: AircraftRole,
  payloadCapacity: number,
  attrs: AircraftAttrs,
  blurb: string,
  strengths: string,
  limitations: string,
): AircraftProfile {
  return { aircraft, role, payloadCapacity, attrs, blurb, strengths, limitations };
}

/**
 * Identidades por silhueta real → ratios arcade.
 * Não é ladder de poder: cada entrada tem trade-off explícito.
 */
export const AIRCRAFT_PROFILES: readonly AircraftProfile[] = [
  p(
    Aircraft.F22_RAPTOR,
    "stealth",
    10,
    { speed: 88, acceleration: 90, maneuver: 92, energy: 88, payload: 62, toughness: 70, precision: 86, radar: 90, rcs: 18 },
    "Caça furtivo de superioridade — primeiro tiro, manobra limpa.",
    "Furtividade · agilidade · radar forte",
    "Carga limitada · racks internos",
  ),
  p(
    Aircraft.F15_EAGLE,
    "air_superiority",
    14,
    { speed: 94, acceleration: 86, maneuver: 78, energy: 92, payload: 88, toughness: 82, precision: 80, radar: 86, rcs: 72 },
    "Energia e carga — briga de altitude e mísseis longos.",
    "Velocidade · energia · payload alto",
    "Assinatura alta · menos ágil que leves",
  ),
  p(
    Aircraft.F16_FALCON,
    "agile",
    9,
    { speed: 84, acceleration: 88, maneuver: 94, energy: 80, payload: 58, toughness: 62, precision: 78, radar: 74, rcs: 58 },
    "Leve e nervoso — WVR e curvas apertadas.",
    "Manobra · aceleração",
    "Pouca carga · menos energia em prolongado",
  ),
  p(
    Aircraft.FA18_SUPER_HORNET,
    "multirole",
    12,
    { speed: 86, acceleration: 82, maneuver: 80, energy: 84, payload: 80, toughness: 78, precision: 82, radar: 80, rcs: 60 },
    "Multifunção embarcado — AA e AG equilibrados.",
    "Versatilidade · estabilidade",
    "Sem extremo em velocidade ou stealth",
  ),
  p(
    Aircraft.TYPHOON,
    "air_superiority",
    11,
    { speed: 90, acceleration: 88, maneuver: 90, energy: 86, payload: 72, toughness: 72, precision: 84, radar: 88, rcs: 48 },
    "Delta canard europeu — energia + manobra.",
    "Manobra · radar · WVR/BVR",
    "Carga média · RCS moderado",
  ),
  p(
    Aircraft.RAFALE,
    "multirole",
    11,
    { speed: 88, acceleration: 86, maneuver: 88, energy: 84, payload: 74, toughness: 74, precision: 86, radar: 86, rcs: 42 },
    "Omnirole — troca de papel AA/AG sem drama.",
    "Precisão · flexibilidade · RCS médio-baixo",
    "Não é o mais rápido nem o mais pesado",
  ),
  p(
    Aircraft.SU35,
    "air_superiority",
    13,
    { speed: 92, acceleration: 90, maneuver: 93, energy: 90, payload: 84, toughness: 80, precision: 78, radar: 84, rcs: 70 },
    "Supermanoobra e empuxo — domina o dogfight.",
    "Manobra · aceleração · carga",
    "Assinatura alta · menos furtivo",
  ),
  p(
    Aircraft.F35_LIGHTNING,
    "stealth",
    10,
    { speed: 82, acceleration: 80, maneuver: 78, energy: 76, payload: 68, toughness: 72, precision: 90, radar: 94, rcs: 16 },
    "Sensor fusion e stealth — informação primeiro.",
    "Radar · precisão · RCS baixíssimo",
    "Menos raw speed/manobra que 4ª gen",
  ),
  p(
    Aircraft.F14_TOMCAT,
    "interceptor",
    13,
    { speed: 93, acceleration: 84, maneuver: 74, energy: 88, payload: 86, toughness: 80, precision: 76, radar: 88, rcs: 78 },
    "Interceptador naval — BVR longo e energia.",
    "Velocidade · radar · mísseis longos",
    "Pesado em curva · RCS alto",
  ),
  p(
    Aircraft.GRIPEN,
    "agile",
    8,
    { speed: 82, acceleration: 86, maneuver: 91, energy: 78, payload: 54, toughness: 60, precision: 80, radar: 76, rcs: 44 },
    "Leve sueco — custo-benefício em manobra.",
    "Agilidade · RCS moderado",
    "Payload baixo · menos energia",
  ),
  p(
    Aircraft.MIRAGE_2000,
    "interceptor",
    9,
    { speed: 90, acceleration: 84, maneuver: 82, energy: 82, payload: 60, toughness: 64, precision: 78, radar: 72, rcs: 55 },
    "Delta clássico — subida e interceptação.",
    "Velocidade · simplicidade",
    "Carga e sensores médios",
  ),
  p(
    Aircraft.F2,
    "multirole",
    10,
    { speed: 84, acceleration: 84, maneuver: 86, energy: 80, payload: 70, toughness: 68, precision: 82, radar: 78, rcs: 52 },
    "Derivado do Falcon — multirole com ênfase AG.",
    "Manobra · carga útil",
    "Sem stealth · energia média",
  ),
  p(
    Aircraft.MIG29,
    "agile",
    10,
    { speed: 88, acceleration: 90, maneuver: 90, energy: 82, payload: 66, toughness: 68, precision: 74, radar: 70, rcs: 68 },
    "Dogfighter clássico — WVR agressivo.",
    "Aceleração · manobra",
    "Alcance/radar médios · RCS alto",
  ),
  p(
    Aircraft.MIG35,
    "multirole",
    11,
    { speed: 88, acceleration: 88, maneuver: 88, energy: 84, payload: 74, toughness: 72, precision: 80, radar: 82, rcs: 58 },
    "Evolução do 29 — sensores e multirole.",
    "Equilíbrio AA/AG · manobra",
    "Sem extremo stealth",
  ),
  p(
    Aircraft.SU57,
    "stealth",
    12,
    { speed: 90, acceleration: 90, maneuver: 91, energy: 88, payload: 78, toughness: 76, precision: 84, radar: 88, rcs: 28 },
    "5ª gen russa — stealth + supermanoobra.",
    "Manobra · RCS baixo · carga boa",
    "Menos maduro em sensores que F-35",
  ),
  p(
    Aircraft.YF23,
    "stealth",
    10,
    { speed: 94, acceleration: 88, maneuver: 80, energy: 86, payload: 64, toughness: 70, precision: 82, radar: 84, rcs: 14 },
    "Protótipo veloz e furtivo — energia em linha reta.",
    "Velocidade · RCS mínimo",
    "Menos ágil em dogfight fechado",
  ),
  p(
    Aircraft.F4_PHANTOM,
    "interceptor",
    12,
    { speed: 88, acceleration: 78, maneuver: 68, energy: 80, payload: 82, toughness: 84, precision: 70, radar: 68, rcs: 85 },
    "Lenda pesada — carga e resistência, pouca graça.",
    "Payload · toughness",
    "Manobra fraca · RCS altíssimo",
  ),
  p(
    Aircraft.SU34,
    "strike",
    15,
    { speed: 78, acceleration: 72, maneuver: 62, energy: 74, payload: 96, toughness: 90, precision: 84, radar: 76, rcs: 75 },
    "Bombardeiro de combate — AG pesado.",
    "Carga enorme · resistência",
    "Lento · pouco ágil",
  ),
  p(
    Aircraft.A10,
    "strike",
    14,
    { speed: 55, acceleration: 48, maneuver: 48, energy: 52, payload: 92, toughness: 96, precision: 88, radar: 40, rcs: 90 },
    "Tanque voador — AG devastador, AA só de emergência.",
    "Toughness · precisão AG · payload",
    "Muito lento · vulnerável a caças",
  ),
  p(
    Aircraft.B2,
    "stealth",
    16,
    { speed: 72, acceleration: 58, maneuver: 35, energy: 60, payload: 98, toughness: 70, precision: 92, radar: 70, rcs: 8 },
    "Stealth estratégico — carga massiva, zero dogfight.",
    "RCS mínimo · payload · precisão",
    "Extremamente pouco manobrável",
  ),
  p(
    Aircraft.U2,
    "recon",
    4,
    { speed: 58, acceleration: 50, maneuver: 32, energy: 55, payload: 25, toughness: 40, precision: 70, radar: 95, rcs: 50 },
    "Olho em altitude — sensores, quase sem combate.",
    "Radar · altitude / observação",
    "Frágil · lento · carga mínima",
  ),
];

const BY_AIRCRAFT = new Map(AIRCRAFT_PROFILES.map((x) => [x.aircraft, x]));

export function aircraftProfile(aircraft: Aircraft): AircraftProfile {
  return BY_AIRCRAFT.get(aircraft) ?? AIRCRAFT_PROFILES[0]!;
}
