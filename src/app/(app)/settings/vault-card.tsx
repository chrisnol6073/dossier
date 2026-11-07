"use client";

import { useState } from "react";

import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { syncVaultAction } from "./actions";

export type VaultView = {
  /** The vault folder inside the container; null while JOBS_IRELAND_VAULT_DIR isn't set. */
  dir: string | null;
  /** "today at 14:32" */
  lastRun: string | null;
  problem: string | null;
};

/**
 * Settings → Your data → Obsidian vault: where the notes go, when they were
 * last written, and a button to write them now. Without a vault, how to add one.
 */
export function VaultCard({ initial }: { initial: VaultView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setBusy(true);
    const result = await syncVaultAction({});
    setBusy(false);
    if (!result.ok) {
      setView((current) => ({ ...current, problem: result.error }));
      toast(result.error);
      return;
    }
    setView((current) => ({ ...current, lastRun: "just now", problem: null }));
    toast(`Wrote ${result.data.applications} application and ${result.data.finds} job find notes to the vault.`);
  };

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-field font-medium">Obsidian vault</h3>
      {view.dir ? (
        <>
          <p className="text-meta text-muted">
            Every quarter of an hour, Jobs Ireland writes a note for each application and each job the agent found worth a look into the{" "}
            <strong className="text-ink">Jobs Ireland</strong> folder of your vault, with an overview note. What you write below the end line of a note is kept.
          </p>
          <p className="text-meta text-muted">
            {view.problem ? <span className="text-error">Last try failed: {view.problem}</span> : view.lastRun ? `Last written ${view.lastRun}.` : "Not written yet."}
          </p>
          <div>
            <Button variant="secondary" onClick={() => void sync()} disabled={busy}>
              {busy ? "Writing…" : "Write notes now"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-meta text-muted">
          Off. To keep notes in your Obsidian vault, set <code className="font-mono text-label">JOBS_IRELAND_VAULT_PATH</code> in <code className="font-mono text-label">.env</code>{" "}
          to your vault folder and restart (see docs/EUROPE.md).
        </p>
      )}
    </Card>
  );
}
