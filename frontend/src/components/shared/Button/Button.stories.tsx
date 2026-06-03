import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta = {
  title: "shared/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "ボードを作成", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "キャンセル", variant: "secondary" },
};

export const Disabled: Story = {
  args: { children: "送信できません", variant: "primary", disabled: true },
};
