import type { LatticePlugin } from "@lattice/plugin-api";

const plugin: LatticePlugin = {
  onload(context) {
    context.commands.register({
      id: "sample-command.say-active-note",
      title: "Sample: Print active note",
      callback() {
        console.info("Sample plugin loaded for", context.id);
      },
    });
  },
};

export default plugin;
