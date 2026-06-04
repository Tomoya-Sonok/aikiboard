import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { EventOccurrence } from "@/lib/types/event";
import { EventForm } from "./EventForm";

const occurrence: EventOccurrence = {
  eventId: "00000000-0000-0000-0000-0000000000bb",
  occurrenceStart: "2026-06-15T10:00:00.000Z",
  startAt: "2026-06-15T10:00:00.000Z",
  endAt: "2026-06-15T12:00:00.000Z",
  place: "本部道場",
  instructorName: "山田 太郎",
  note: "受け身中心",
  isPublic: true,
  isRecurring: true,
  isOverridden: false,
  recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE",
  attendingCount: 5,
  decliningCount: 1,
  myStatus: "attend",
  canManage: true,
};

const meta = {
  title: "features/events/EventForm",
  component: EventForm,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    onSaved: () => {},
    boardId: "00000000-0000-0000-0000-0000000000aa",
  },
} satisfies Meta<typeof EventForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  args: { mode: "create", defaultDate: "2026-06-01" },
};

export const EditSeries: Story = {
  args: { mode: "editSeries", occurrence },
};

export const EditOccurrence: Story = {
  args: { mode: "editOccurrence", occurrence },
};
