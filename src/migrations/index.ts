import * as migration_20261014_150125_initial from './20261014_150125_initial';

export const migrations = [
  {
    up: migration_20261014_150125_initial.up,
    down: migration_20261014_150125_initial.down,
    name: '20261014_150125_initial'
  },
];
