import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

const meta = {
  title: "shared/Dialog",
  component: Dialog,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    title: "稽古の詳細",
    children: "ここにモーダルの内容が入ります。",
    onClose: () => {},
  },
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ padding: 24 }}>
        <Button onClick={() => setOpen(true)}>開く</Button>
        <Dialog
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                OK
              </Button>
            </>
          }
        />
      </div>
    );
  },
};
