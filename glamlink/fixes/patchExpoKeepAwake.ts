/**
 * Expo 54 automatically enables dev keep-awake via `expo-keep-awake`.
 * On some Android builds the native module rejects with `Unable to activate keep awake`
 * because the current activity is not yet available when the hook runs.
 *
 * We monkey-patch the exported helpers so the failure is swallowed in dev
 * while keeping the real implementation for every other case.
 */
type ActivateKeepAwake = (tag?: string) => Promise<void>;

type KeepAwakeModule = {
  activateKeepAwakeAsync?: ActivateKeepAwake;
  activateKeepAwake?: (tag?: string) => Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires -- CommonJS interop makes patching easier.
const keepAwake = require("expo-keep-awake") as KeepAwakeModule;

const TAG = "[keep-awake]";

const patchActivation = (label: "activateKeepAwakeAsync" | "activateKeepAwake") => {
  const original = keepAwake[label];
  if (typeof original !== "function") {
    return;
  }

  keepAwake[label] = async (...args: Parameters<ActivateKeepAwake>) => {
    try {
      await original(...args);
    } catch (error) {
      if (__DEV__) {
        const message =
          error instanceof Error ? error.message : typeof error === "string" ? error : undefined;

        if (message?.includes("Unable to activate keep awake")) {
          console.info(
            `${TAG} Dev keep-awake failed (activity not ready yet). Continuing without it.`,
          );
          return;
        }
      }

      throw error;
    }
  };
};

patchActivation("activateKeepAwakeAsync");
patchActivation("activateKeepAwake");
