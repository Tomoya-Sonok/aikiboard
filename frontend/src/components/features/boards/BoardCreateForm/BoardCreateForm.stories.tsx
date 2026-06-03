import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BoardCreateForm } from "./BoardCreateForm";

const meta = {
  title: "features/boards/BoardCreateForm",
  component: BoardCreateForm,
  parameters: { layout: "padded" },
  args: {
    onSubmit: () => {},
    searchDojos: async () => [
      {
        id: "1",
        dojo_name: "合気会本部道場",
        dojo_name_kana: "あいきかいほんぶどうじょう",
      },
    ],
  },
  tags: ["autodocs"],
} satisfies Meta<typeof BoardCreateForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

export const WithServerError: Story = {
  args: { serverError: "この URL は既に使われています" },
};
