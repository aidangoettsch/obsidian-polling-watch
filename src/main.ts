import {App, Plugin, PluginManifest, PluginSettingTab, Setting, TAbstractFile} from "obsidian";
import * as path from "path"
import * as fs from "fs/promises"
import { FSWatcher } from "fs"

declare module "obsidian" {
  export interface Watcher {
    resolvedPath: string
    watcher: FSWatcher
  }

  export interface DataAdapter {
    basePath: string
    watchers: { [path: string]: Watcher }
  }

  export interface Vault {
  }
}

export default class PollingWatch extends Plugin {
  private setting!: MyPluginSettings;
  private pollTimer!: number;
  async onload() {
    console.log("Plugin is Loading...");

    this.setting = (await this.loadData()) || {
      pollInterval: 2000,
    };
    this.addSettingTab(new MyPluginSettingsTab(this.app, this));
    this.pollTimer = window.setInterval(() => this.poll(), this.setting.pollInterval)
    // await this.poll()
  }

  async poll() {
    console.log(this.app.vault)

    const watchers = this.app.vault.adapter.watchers
    await Promise.all(Object.keys(watchers).map(async normalizedPath => {
      if (normalizedPath.startsWith(".obsidian")) return

      const { resolvedPath } = watchers[normalizedPath]

      const listing = await fs.readdir(resolvedPath, {
        withFileTypes: true
      })

      for (const f of listing) {
        console.log(`updating ${path.join(normalizedPath, f.name)}`)
        // @ts-ignore
        this.app.vault.adapter.onFileChange(path.join(normalizedPath, f.name))
      }
    }))
  }

  async setPollInterval(value: number): Promise<void> {
    this.setting.pollInterval = value;
    await this.saveData(this.setting);

    window.clearInterval(this.pollTimer)
    this.pollTimer = window.setInterval(() => this.poll(), this.setting.pollInterval)
  }

  onunload(): void {
    window.clearInterval(this.pollTimer)
  }

  get pollInterval(): number {
    return this.setting.pollInterval
  }
}

/**
 * This is a data class that contains your plugin configurations. You can edit it
 * as you wish by adding fields and all the data you need.
 */
interface MyPluginSettings {
  pollInterval: number;
}

class MyPluginSettingsTab extends PluginSettingTab {
  plugin: PollingWatch;

  constructor(app: App, plugin: PollingWatch) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    new Setting(containerEl)
      .setName("Poll Interval")
      .setDesc("Interval between disk accesses")
      .addText((text) =>
        text.setValue(String(this.plugin.pollInterval)).onChange(async (value) => {
          if (!isNaN(Number(value))) {
            await this.plugin.setPollInterval(Number(value))
          }
        })
      );
  }
}
