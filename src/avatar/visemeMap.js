/**
 * Microsoft Speech Service viseme IDs (0-21) → Oculus viseme blendshape names.
 *
 * Reference: https://learn.microsoft.com/azure/ai-services/speech-service/how-to-speech-synthesis-viseme
 *
 * Microsoft's set is a superset of Oculus's 15 visemes, so several MS IDs
 * fold into the same Oculus shape. Mapping below is the standard one used
 * by Ready Player Me / Oculus LipSync.
 */
export const MS_VISEME_TO_OCULUS = {
  0:  'viseme_sil',  // silence
  1:  'viseme_aa',   // æ, ə, ʌ
  2:  'viseme_aa',   // ɑ
  3:  'viseme_O',    // ɔ
  4:  'viseme_E',    // ɛ, ʊ
  5:  'viseme_RR',   // ɝ
  6:  'viseme_I',    // j, i, ɪ
  7:  'viseme_U',    // w, u
  8:  'viseme_O',    // o
  9:  'viseme_aa',   // aʊ
  10: 'viseme_O',    // ɔɪ
  11: 'viseme_I',    // aɪ
  12: 'viseme_RR',   // h
  13: 'viseme_RR',   // ɹ
  14: 'viseme_nn',   // l
  15: 'viseme_SS',   // s, z
  16: 'viseme_CH',   // ʃ, tʃ, dʒ, ʒ
  17: 'viseme_TH',   // ð
  18: 'viseme_FF',   // f, v
  19: 'viseme_DD',   // d, t, n, θ
  20: 'viseme_kk',   // k, g, ŋ
  21: 'viseme_PP',   // p, b, m
};

export const OCULUS_VISEMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk',  'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa',  'viseme_E',  'viseme_I',  'viseme_O',  'viseme_U',
];

export function msVisemeToOculus(id) {
  return MS_VISEME_TO_OCULUS[id] ?? 'viseme_sil';
}
