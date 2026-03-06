import { calculateEmissionLoss } from './src/engine/systems/heating-emission-loss';

const result = calculateEmissionLoss({
    Q_h_b: 511.9,
    theta_i: 20.0,
    theta_e: -3.9,
    emitterType: 'radiator',
    spaceCategory: 'standard',
    pipingType: 'two_pipe',
    controlType: 'p_control'
});

console.log('Result:', JSON.stringify(result, null, 2));
