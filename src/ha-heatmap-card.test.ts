// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import './ha-heatmap-card';

interface EditorElement extends HTMLElement {
  setConfig(config: object): void;
  updateComplete: Promise<boolean>;
}

interface CardElement extends HTMLElement {
  setConfig(config: object): void;
  hass: object;
  updateComplete: Promise<boolean>;
}

const nextUpdate = async (element: { updateComplete: Promise<boolean> }): Promise<void> => {
  await element.updateComplete;
  await Promise.resolve();
};

describe('ha-heatmap-card editor', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('emits an independent updated configuration when distributing sensors', async () => {
    const editor = document.createElement('ha-heatmap-card-editor') as EditorElement;
    const config = {
      background_image: '/local/floorplan.png',
      entities: [
        { entity_id: 'sensor.one', x: 0, y: 0 },
        { entity_id: 'sensor.two', x: 0, y: 0 },
        { entity_id: 'sensor.three', x: 0, y: 0 },
      ],
    };
    const changed = vi.fn();
    editor.addEventListener('config-changed', changed);
    document.body.append(editor);
    editor.setConfig(config);
    await nextUpdate(editor);

    const distributeButton = Array.from(editor.shadowRoot!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Distribute sensors')) as HTMLButtonElement;
    distributeButton.click();
    await nextUpdate(editor);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].detail.config.entities).toEqual([
      { entity_id: 'sensor.one', x: 0.3333, y: 0.3333 },
      { entity_id: 'sensor.two', x: 0.6667, y: 0.3333 },
      { entity_id: 'sensor.three', x: 0.3333, y: 0.6667 },
    ]);
    expect(config.entities[0]).toEqual({ entity_id: 'sensor.one', x: 0, y: 0 });
  });

  it('adds a sensor and emits the visual-editor draft configuration', async () => {
    const editor = document.createElement('ha-heatmap-card-editor') as EditorElement;
    const changed = vi.fn();
    editor.addEventListener('config-changed', changed);
    document.body.append(editor);
    editor.setConfig({ background_image: '', entities: [] });
    await nextUpdate(editor);

    const addButton = Array.from(editor.shadowRoot!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Add temperature sensor')) as HTMLButtonElement;
    addButton.click();

    expect(changed.mock.calls[0][0].detail.config.entities).toEqual([
      { entity_id: '', x: 0.5, y: 0.5 },
    ]);
  });
});

describe('ha-heatmap-card calibration', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('moves a calibration target and copies the changed coordinates as YAML', async () => {
    const card = document.createElement('ha-heatmap-card') as CardElement;
    document.body.append(card);
    card.setConfig({
      background_image: '',
      edit_mode: true,
      entities: [{ entity_id: 'sensor.office_temperature', x: 0.1, y: 0.1 }],
    });
    card.hass = {
      states: {
        'sensor.office_temperature': {
          state: '21.5',
          attributes: { friendly_name: 'Office' },
        },
      },
    };
    await nextUpdate(card);

    const container = card.shadowRoot!.querySelector('.container') as HTMLElement;
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200,
      toJSON: () => ({}),
    });
    const target = card.shadowRoot!.querySelector('.calibration-target') as HTMLButtonElement;
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 80, clientY: 20 }));
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 150 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await nextUpdate(card);

    const copyButton = Array.from(card.shadowRoot!.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Copy YAML')) as HTMLButtonElement;
    copyButton.click();
    await nextUpdate(card);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('    x: 0.75\n    y: 0.75'));
  });
});
