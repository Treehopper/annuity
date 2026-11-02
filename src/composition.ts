import { createCore, type Core } from '@alp/core';

import { deviceClock } from '@/platform/clock';
import { files } from '@/platform/files';
import { ids } from '@/platform/ids';
import { notifications } from '@/platform/notifications';
import { createDataStore } from '@/platform/storage';

/** The only place that creates platform adapters and wires them into the core (§4.2). */
let core: Core | undefined;

export function getCore(): Core {
  core ??= createCore({ store: createDataStore(), clock: deviceClock, ids, notifications, files });
  return core;
}
