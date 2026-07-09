import { beforeEach, describe, expect, it } from "vitest";
import { localStorageProvider as provider } from "./localStorageProvider";

const STORAGE_KEY = "legal-client-tracker:clients";

beforeEach(() => {
  localStorage.clear();
});

describe("localStorageProvider — clients", () => {
  it("seeds demo data on first fetch", async () => {
    const data = await provider.fetchAll();
    expect(data.clients.length).toBeGreaterThan(0);
    expect(data.history.length).toBeGreaterThan(0);
  });

  it("creates a client and logs a client_created event", async () => {
    await provider.fetchAll(); // trigger seed so we can assert relative counts
    const before = await provider.fetchAll();
    const after = await provider.createClient({
      name: "Тестов Тест",
      phone: "+7 900 000-00-00",
      status: "new",
    });
    expect(after.clients.length).toBe(before.clients.length + 1);
    const created = after.clients.find((c) => c.name === "Тестов Тест");
    expect(created).toBeTruthy();
    expect(
      after.history.some(
        (h) => h.clientId === created!.id && h.type === "client_created",
      ),
    ).toBe(true);
  });

  it("carries matter fields from NewClientInput into the stored client", async () => {
    const data = await provider.createClient({
      name: "С Полями",
      phone: "+7 900 111-22-33",
      status: "new",
      matterType: "claim",
      stage: "intake",
      keyDeadline: "2026-08-01",
    });
    const created = data.clients.find((c) => c.name === "С Полями");
    expect(created?.matterType).toBe("claim");
    expect(created?.stage).toBe("intake");
    expect(created?.keyDeadline).toBe("2026-08-01");
  });

  it("changes status and records a status_changed event with metadata", async () => {
    const seeded = await provider.fetchAll();
    const client = seeded.clients[0];
    const after = await provider.updateClientStatus(client.id, "in_progress");
    const updated = after.clients.find((c) => c.id === client.id);
    expect(updated?.status).toBe("in_progress");
    const event = after.history.find(
      (h) => h.clientId === client.id && h.type === "status_changed",
    );
    expect(event?.metadata).toMatchObject({ to: "in_progress" });
  });

  it("does not write a history event when the status is unchanged", async () => {
    const seeded = await provider.fetchAll();
    const client = seeded.clients[0];
    const before = await provider.fetchAll();
    const after = await provider.updateClientStatus(client.id, client.status);
    expect(after.history.length).toBe(before.history.length);
  });

  it("soft-deletes a client: hidden from fetchAll but not lost", async () => {
    const seeded = await provider.fetchAll();
    const client = seeded.clients[0];
    const after = await provider.softDeleteClient(client.id);
    expect(after.clients.find((c) => c.id === client.id)).toBeUndefined();

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const stillStored = raw.clients.find((c: { id: string }) => c.id === client.id);
    expect(stillStored?.deletedAt).toBeTruthy();
  });
});

describe("localStorageProvider — tasks, deadlines, risks", () => {
  it("toggles a task and logs task_completed only when completing", async () => {
    const seeded = await provider.fetchAll();
    const client = seeded.clients[0];
    const withTask = await provider.createTask(client.id, "Позвонить", "2026-08-01");
    const task = withTask.tasks.find((t) => t.clientId === client.id && t.title === "Позвонить")!;

    const completed = await provider.toggleTask(task.id);
    expect(completed.tasks.find((t) => t.id === task.id)?.completed).toBe(true);
    expect(
      completed.history.some((h) => h.type === "task_completed"),
    ).toBe(true);

    const reopened = await provider.toggleTask(task.id);
    expect(reopened.tasks.find((t) => t.id === task.id)?.completed).toBe(false);
  });

  it("creates and toggles a matter deadline", async () => {
    const seeded = await provider.fetchAll();
    const client = seeded.clients[0];
    const withDeadline = await provider.createDeadline(
      client.id,
      "Подать апелляцию",
      "2026-09-01",
      "procedural",
    );
    const deadline = withDeadline.deadlines.find(
      (d) => d.clientId === client.id && d.title === "Подать апелляцию",
    )!;
    expect(deadline.deadlineType).toBe("procedural");

    const toggled = await provider.toggleDeadline(deadline.id);
    expect(toggled.deadlines.find((d) => d.id === deadline.id)?.completed).toBe(
      true,
    );
  });

  it("adds and resolves a risk", async () => {
    const seeded = await provider.fetchAll();
    const client = seeded.clients[0];
    const withRisk = await provider.addRisk(client.id, "Возможен встречный иск");
    const risk = withRisk.risks.find((r) => r.clientId === client.id)!;
    expect(risk.isResolved).toBe(false);

    const resolved = await provider.resolveRisk(risk.id);
    expect(resolved.risks.find((r) => r.id === risk.id)?.isResolved).toBe(true);
  });
});

describe("localStorageProvider — reference data", () => {
  it("returns non-empty dictionaries covering the demo seed's codes", async () => {
    const ref = await provider.getReferenceData();
    expect(ref.matterTypes.length).toBeGreaterThan(0);
    expect(ref.matterStages.length).toBeGreaterThan(0);
    expect(ref.deadlineTypes.some((t) => t.code === "procedural")).toBe(true);
  });
});

describe("localStorageProvider — v1 data migration", () => {
  it("migrates a plain-array (v1) save into the current AppData shape", async () => {
    const v1 = [
      {
        id: "legacy-1",
        name: "Старый клиент",
        phone: "+7 900 999-99-99",
        status: "new",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    const data = await provider.fetchAll();
    expect(data.clients).toHaveLength(1);
    expect(data.clients[0].name).toBe("Старый клиент");
    expect(data.deadlines).toEqual([]);
    expect(data.risks).toEqual([]);
    expect(
      data.history.some((h) => h.clientId === "legacy-1" && h.type === "client_created"),
    ).toBe(true);
  });
});
