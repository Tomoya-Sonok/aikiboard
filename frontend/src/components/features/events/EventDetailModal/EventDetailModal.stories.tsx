import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { EventOccurrence } from "@/lib/types/event";
import { EventDetailModal } from "./EventDetailModal";

const baseOccurrence: EventOccurrence = {
  eventId: "00000000-0000-0000-0000-0000000000bb",
  occurrenceStart: "2026-06-15T10:00:00.000Z",
  startAt: "2026-06-15T10:00:00.000Z",
  endAt: "2026-06-15T12:00:00.000Z",
  place: "本部道場",
  instructorName: "山田 太郎",
  note: "受け身を中心に稽古します。",
  isPublic: true,
  isRecurring: true,
  isOverridden: false,
  recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  attendingCount: 5,
  decliningCount: 1,
  myStatus: "attend",
  canManage: true,
};

const meta = {
  title: "features/events/EventDetailModal",
  component: EventDetailModal,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onClose: () => {},
    onEdit: () => {},
    onChanged: () => {},
  },
} satisfies Meta<typeof EventDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdminRecurring: Story = {
  args: { occurrence: baseOccurrence },
};

export const Member: Story = {
  args: {
    occurrence: { ...baseOccurrence, canManage: false, myStatus: null },
  },
};

export const SingleEvent: Story = {
  args: {
    occurrence: {
      ...baseOccurrence,
      isRecurring: false,
      recurrenceRule: null,
      instructorName: null,
      note: null,
    },
  },
};
