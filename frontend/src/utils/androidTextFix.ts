/**
 * Android text clipping fix.
 *
 * On several Android OEM skins (Tecno/Infinix/Itel, Oppo/Realme, Xiaomi) the
 * system default font is measured narrower than it renders, so the last
 * letter of labels gets cut ("Ratin", "Profil", "10/10/202") and short
 * labels wrap unexpectedly. Giving every Text an explicit font family plus
 * the simple line-breaking strategy makes measurement and rendering match.
 * Styles that set their own fontFamily (e.g. vector icons) still win because
 * our default is placed first in the style array.
 */
import React from 'react';
import { Platform } from 'react-native';
import * as RN from 'react-native';

if (Platform.OS === 'android') {
  const OriginalText = RN.Text as any;
  if (!OriginalText.__istylistPatched) {
    const DEFAULT_STYLE = { fontFamily: 'sans-serif' };
    const PatchedText = (props: any) =>
      React.createElement(OriginalText, {
        textBreakStrategy: 'simple',
        ...props,
        style: [DEFAULT_STYLE, props.style],
      });
    PatchedText.displayName = 'Text';
    (PatchedText as any).__istylistPatched = true;
    try {
      const rnModule = require('react-native');
      Object.defineProperty(rnModule, 'Text', {
        configurable: true,
        enumerable: true,
        get: () => PatchedText,
      });
    } catch {
      // If the export can't be redefined, keep the stock Text.
    }
  }
}
