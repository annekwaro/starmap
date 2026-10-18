export interface Constellation {
  name: string;
  /** Polylines through star names from STARS; each inner array is drawn as one chain. */
  lines: string[][];
}

export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Orion',
    lines: [
      ['Betelgeuse', 'Meissa', 'Bellatrix'],
      ['Betelgeuse', 'Alnitak', 'Alnilam', 'Mintaka', 'Bellatrix'],
      ['Alnitak', 'Saiph'],
      ['Mintaka', 'Rigel'],
    ],
  },
  {
    name: 'Ursa Major',
    lines: [['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez']],
  },
  {
    name: 'Ursa Minor',
    lines: [
      ['Polaris', 'Yildun', 'Epsilon Ursae Minoris', 'Zeta Ursae Minoris', 'Kochab', 'Pherkad', 'Eta Ursae Minoris', 'Zeta Ursae Minoris'],
    ],
  },
  {
    name: 'Cassiopeia',
    lines: [['Caph', 'Schedar', 'Gamma Cassiopeiae', 'Ruchbah', 'Segin']],
  },
  {
    name: 'Cygnus',
    lines: [
      ['Deneb', 'Sadr', 'Albireo'],
      ['Fawaris', 'Sadr', 'Aljanah'],
    ],
  },
  {
    name: 'Lyra',
    lines: [['Vega', 'Zeta Lyrae', 'Sheliak', 'Sulafat', 'Delta Lyrae', 'Zeta Lyrae']],
  },
  {
    name: 'Aquila',
    lines: [['Tarazed', 'Altair', 'Alshain']],
  },
  {
    name: 'Scorpius',
    lines: [
      ['Acrab', 'Dschubba', 'Fang'],
      [
        'Dschubba',
        'Alniyat',
        'Antares',
        'Paikauhale',
        'Larawag',
        'Xamidimura',
        'Zeta Scorpii',
        'Eta Scorpii',
        'Sargas',
        'Iota Scorpii',
        'Girtab',
        'Shaula',
      ],
    ],
  },
  {
    name: 'Crux',
    lines: [
      ['Gacrux', 'Acrux'],
      ['Mimosa', 'Imai'],
    ],
  },
  {
    name: 'Leo',
    lines: [
      ['Regulus', 'Eta Leonis', 'Algieba', 'Adhafera', 'Rasalas', 'Algenubi'],
      ['Algieba', 'Zosma', 'Denebola', 'Chertan', 'Regulus'],
      ['Zosma', 'Chertan'],
    ],
  },
  {
    name: 'Gemini',
    lines: [
      ['Castor', 'Pollux'],
      ['Castor', 'Mebsuta', 'Tejat'],
      ['Pollux', 'Wasat', 'Alhena'],
    ],
  },
  {
    name: 'Taurus',
    lines: [['Tianguan', 'Aldebaran', 'Prima Hyadum', 'Secunda Hyadum', 'Ain', 'Elnath']],
  },
  {
    name: 'Canis Major',
    lines: [
      ['Mirzam', 'Sirius', 'Wezen', 'Aludra'],
      ['Wezen', 'Adhara', 'Furud'],
    ],
  },
  {
    name: 'Pegasus',
    lines: [
      ['Markab', 'Scheat', 'Alpheratz', 'Algenib', 'Markab'],
      ['Markab', 'Homam', 'Biham', 'Enif'],
    ],
  },
  {
    name: 'Andromeda',
    lines: [['Alpheratz', 'Delta Andromedae', 'Mirach', 'Almach']],
  },
];
