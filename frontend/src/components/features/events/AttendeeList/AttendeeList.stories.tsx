import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AttendeeList } from "./AttendeeList";

const meta = {
  title: "features/events/AttendeeList",
  component: AttendeeList,
  parameters: { layout: "padded" },
} satisfies Meta<typeof AttendeeList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMembers: Story = {
  args: {
    label: "参加者",
    members: [
      { userId: "1", username: "鈴木 太郎", profileImageUrl: null },
      {
        userId: "2",
        username: "佐藤 花子",
        profileImageUrl: "https://i.pravatar.cc/48",
      },
      { userId: "3", username: "田中 一郎", profileImageUrl: null },
    ],
  },
};

export const Empty: Story = {
  args: {
    label: "参加者",
    members: [],
    emptyText: "まだ回答がありません",
  },
};
