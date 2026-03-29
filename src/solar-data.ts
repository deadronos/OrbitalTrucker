export const ASTRONOMICAL_UNIT_KM = 149_597_870.7
export const SECONDS_PER_DAY = 86_400

type OrbitalSeries = {
  base: number
  rate: number
}

export type OrbitalElementSet = {
  semiMajorAxisAu: OrbitalSeries
  eccentricity: OrbitalSeries
  inclinationDeg: OrbitalSeries
  meanLongitudeDeg: OrbitalSeries
  longitudeOfPerihelionDeg: OrbitalSeries
  longitudeOfAscendingNodeDeg: OrbitalSeries
}

export type SolarBodyDefinition = {
  name: string
  kind: 'planet' | 'dwarf-planet'
  color: string
  radiusKm: number
  displayRadiusAu: number
  orbitColor: string
  orbitalPeriodDays: number
  elements: OrbitalElementSet
}

export const SUN = {
  name: 'Sun',
  color: '#ffd27d',
  radiusKm: 696_340,
  displayRadiusAu: 0.095,
}

export const SOLAR_BODIES: SolarBodyDefinition[] = [
  {
    name: 'Mercury',
    kind: 'planet',
    color: '#b7aea0',
    radiusKm: 2_439.7,
    displayRadiusAu: 0.006,
    orbitColor: '#6e6259',
    orbitalPeriodDays: 87.969,
    elements: {
      semiMajorAxisAu: { base: 0.38709927, rate: 0.00000037 },
      eccentricity: { base: 0.20563593, rate: 0.00001906 },
      inclinationDeg: { base: 7.00497902, rate: -0.00594749 },
      meanLongitudeDeg: { base: 252.2503235, rate: 149_472.67411175 },
      longitudeOfPerihelionDeg: { base: 77.45779628, rate: 0.16047689 },
      longitudeOfAscendingNodeDeg: { base: 48.33076593, rate: -0.12534081 },
    },
  },
  {
    name: 'Venus',
    kind: 'planet',
    color: '#e8c58d',
    radiusKm: 6_051.8,
    displayRadiusAu: 0.0085,
    orbitColor: '#9c7b4d',
    orbitalPeriodDays: 224.701,
    elements: {
      semiMajorAxisAu: { base: 0.72333566, rate: 0.0000039 },
      eccentricity: { base: 0.00677672, rate: -0.00004107 },
      inclinationDeg: { base: 3.39467605, rate: -0.0007889 },
      meanLongitudeDeg: { base: 181.9790995, rate: 58_517.81538729 },
      longitudeOfPerihelionDeg: { base: 131.60246718, rate: 0.00268329 },
      longitudeOfAscendingNodeDeg: { base: 76.67984255, rate: -0.27769418 },
    },
  },
  {
    name: 'Earth',
    kind: 'planet',
    color: '#7ec8ff',
    radiusKm: 6_371,
    displayRadiusAu: 0.009,
    orbitColor: '#3d74cc',
    orbitalPeriodDays: 365.256,
    elements: {
      semiMajorAxisAu: { base: 1.00000261, rate: 0.00000562 },
      eccentricity: { base: 0.01671123, rate: -0.00004392 },
      inclinationDeg: { base: -0.00001531, rate: -0.01294668 },
      meanLongitudeDeg: { base: 100.46457166, rate: 35_999.37244981 },
      longitudeOfPerihelionDeg: { base: 102.93768193, rate: 0.32327364 },
      longitudeOfAscendingNodeDeg: { base: 0, rate: 0 },
    },
  },
  {
    name: 'Mars',
    kind: 'planet',
    color: '#d17c56',
    radiusKm: 3_389.5,
    displayRadiusAu: 0.0075,
    orbitColor: '#8f4736',
    orbitalPeriodDays: 686.98,
    elements: {
      semiMajorAxisAu: { base: 1.52371034, rate: 0.00001847 },
      eccentricity: { base: 0.0933941, rate: 0.00007882 },
      inclinationDeg: { base: 1.84969142, rate: -0.00813131 },
      meanLongitudeDeg: { base: -4.55343205, rate: 19_140.30268499 },
      longitudeOfPerihelionDeg: { base: -23.94362959, rate: 0.44441088 },
      longitudeOfAscendingNodeDeg: { base: 49.55953891, rate: -0.29257343 },
    },
  },
  {
    name: 'Jupiter',
    kind: 'planet',
    color: '#d4b08c',
    radiusKm: 69_911,
    displayRadiusAu: 0.019,
    orbitColor: '#8d664b',
    orbitalPeriodDays: 4_332.59,
    elements: {
      semiMajorAxisAu: { base: 5.202887, rate: -0.00011607 },
      eccentricity: { base: 0.04838624, rate: -0.00013253 },
      inclinationDeg: { base: 1.30439695, rate: -0.00183714 },
      meanLongitudeDeg: { base: 34.39644051, rate: 3_034.74612775 },
      longitudeOfPerihelionDeg: { base: 14.72847983, rate: 0.21252668 },
      longitudeOfAscendingNodeDeg: { base: 100.47390909, rate: 0.20469106 },
    },
  },
  {
    name: 'Saturn',
    kind: 'planet',
    color: '#d8c18a',
    radiusKm: 58_232,
    displayRadiusAu: 0.017,
    orbitColor: '#8b7956',
    orbitalPeriodDays: 10_759.22,
    elements: {
      semiMajorAxisAu: { base: 9.53667594, rate: -0.0012506 },
      eccentricity: { base: 0.05386179, rate: -0.00050991 },
      inclinationDeg: { base: 2.48599187, rate: 0.00193609 },
      meanLongitudeDeg: { base: 49.95424423, rate: 1_222.49362201 },
      longitudeOfPerihelionDeg: { base: 92.59887831, rate: -0.41897216 },
      longitudeOfAscendingNodeDeg: { base: 113.66242448, rate: -0.28867794 },
    },
  },
  {
    name: 'Uranus',
    kind: 'planet',
    color: '#97ebf2',
    radiusKm: 25_362,
    displayRadiusAu: 0.014,
    orbitColor: '#5e8d93',
    orbitalPeriodDays: 30_688.5,
    elements: {
      semiMajorAxisAu: { base: 19.18916464, rate: -0.00196176 },
      eccentricity: { base: 0.04725744, rate: -0.00004397 },
      inclinationDeg: { base: 0.77263783, rate: -0.00242939 },
      meanLongitudeDeg: { base: 313.23810451, rate: 428.48202785 },
      longitudeOfPerihelionDeg: { base: 170.9542763, rate: 0.40805281 },
      longitudeOfAscendingNodeDeg: { base: 74.01692503, rate: 0.04240589 },
    },
  },
  {
    name: 'Neptune',
    kind: 'planet',
    color: '#5877ff',
    radiusKm: 24_622,
    displayRadiusAu: 0.0145,
    orbitColor: '#3249a8',
    orbitalPeriodDays: 60_182,
    elements: {
      semiMajorAxisAu: { base: 30.06992276, rate: 0.00026291 },
      eccentricity: { base: 0.00859048, rate: 0.00005105 },
      inclinationDeg: { base: 1.77004347, rate: 0.00035372 },
      meanLongitudeDeg: { base: -55.12002969, rate: 218.45945325 },
      longitudeOfPerihelionDeg: { base: 44.96476227, rate: -0.32241464 },
      longitudeOfAscendingNodeDeg: { base: 131.78422574, rate: -0.00508664 },
    },
  },
  {
    name: 'Pluto',
    kind: 'dwarf-planet',
    color: '#c1ae95',
    radiusKm: 1_188.3,
    displayRadiusAu: 0.0048,
    orbitColor: '#847666',
    orbitalPeriodDays: 90_560,
    elements: {
      semiMajorAxisAu: { base: 39.48211675, rate: -0.00031596 },
      eccentricity: { base: 0.2488273, rate: 0.0000517 },
      inclinationDeg: { base: 17.14001206, rate: 0.00004818 },
      meanLongitudeDeg: { base: 238.92903833, rate: 145.20780515 },
      longitudeOfPerihelionDeg: { base: 224.06891629, rate: -0.04062942 },
      longitudeOfAscendingNodeDeg: { base: 110.30393684, rate: -0.01183482 },
    },
  },
]
