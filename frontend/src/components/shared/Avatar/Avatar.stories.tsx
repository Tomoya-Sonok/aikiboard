import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar } from "./Avatar";

const meta = {
  title: "shared/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initial: Story = {
  args: { name: "鈴木 太郎" },
};

export const WithImage: Story = {
  args: {
    name: "鈴木 太郎",
    imageUrl: "https://i.pravatar.cc/64",
    size: 40,
  },
};
