import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { type DojoMaster, DojoMasterSelect } from "./DojoMasterSelect";

const SEED: DojoMaster[] = [
  {
    id: "1",
    dojo_name: "合気会本部道場",
    dojo_name_kana: "あいきかいほんぶどうじょう",
  },
  {
    id: "2",
    dojo_name: "養神館本部道場",
    dojo_name_kana: "ようしんかんほんぶどうじょう",
  },
];

const meta = {
  title: "features/boards/DojoMasterSelect",
  component: DojoMasterSelect,
  parameters: { layout: "padded" },
  args: {
    label: "紐付ける道場",
    value: null,
    onChange: () => {},
    searchDojos: async (q: string) =>
      SEED.filter(
        (d) => d.dojo_name.includes(q) || (d.dojo_name_kana ?? "").includes(q),
      ),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DojoMasterSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Selected: Story = {
  args: { value: SEED[0] },
};

export const WithError: Story = {
  args: { error: "道場を選択してください" },
};
