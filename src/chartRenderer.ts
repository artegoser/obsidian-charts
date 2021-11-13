import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import { MarkdownPostProcessorContext, MarkdownRenderChild, parseYaml } from 'obsidian';
import { generateInnerColors, renderError } from 'src/util';
import type { ChartPluginSettings, ImageOptions } from './constants/settingsConstants';
Chart.register(...registerables);

export default class Renderer {
    settings: ChartPluginSettings;

    constructor(settings: ChartPluginSettings) {
        this.settings = settings;
    }

    datasetPrep(yaml: any): {chartOptions: ChartConfiguration, width: string} {
        const datasets = [];
        for (let i = 0; yaml.series.length > i; i++) {
            datasets.push({
                label: yaml.series[i].title ?? "",
                data: yaml.series[i].data,
                backgroundColor: yaml.labelColors ? generateInnerColors(this.settings.colors) : generateInnerColors(this.settings.colors)[i],
                borderColor: yaml.labelColors ? this.settings.colors : this.settings.colors[i],
                borderWidth: 1,
                fill: yaml.fill ?? false,
                tension: yaml.tension ?? 0,
            });
        }

        let chartOptions;

        if (yaml.type == 'radar' || yaml.type == 'polarArea') {
            chartOptions = {
                type: yaml.type,
                data: {
                    labels: yaml.labels,
                    datasets: datasets
                },
                options: {
                    scales: {
                        r: {
                            grid: { color: 'rgba(122,122,122,0.3)' },
                            beginAtZero: yaml.beginAtZero
                        },
                    },
                    plugins: {
                        legend: {
                            display: yaml.legend,
                            position: yaml.legendPosition
                        }
                    },
                    layout: {
                        padding: yaml.padding
                    }
                }
            };
        } else if (yaml.type == 'bar' || yaml.type == 'line') {
            chartOptions = {
                type: yaml.type,
                data: {
                    labels: yaml.labels,
                    datasets: datasets
                },
                options: {
                    indexAxis: yaml.indexAxis,
                    scales: {
                        y: {
                            min: yaml.yMin,
                            max: yaml.yMax,
                            reverse: yaml.yReverse,
                            ticks: {
                                display: yaml.yTickDisplay,
                                padding: yaml.yTickPadding
                            },
                            display: yaml.yDisplay,
                            stacked: yaml.stacked,
                            beginAtZero: yaml.beginAtZero,
                            grid: { color: 'rgba(122,122,122,0.3)' },
                            title: {
                                display: yaml.yTitle,
                                text: yaml.yTitle
                            }
                        },
                        x: {
                            min: yaml.xMin,
                            max: yaml.xMax,
                            reverse: yaml.xReverse,
                            ticks: {
                                display: yaml.xTickDisplay,
                                padding: yaml.xTickPadding
                            },
                            display: yaml.xDisplay,
                            stacked: yaml.stacked,
                            grid: { color: 'rgba(122,122,122,0.3)' },
                            title: {
                                display: yaml.xTitle,
                                text: yaml.xTitle
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: yaml.legend,
                            position: yaml.legendPosition
                        }
                    },
                    layout: {
                        padding: yaml.padding
                    }
                }
            };
        } else {
            chartOptions = {
                type: yaml.type,
                data: {
                    labels: yaml.labels,
                    datasets: datasets
                },
                options: {
                    plugins: {
                        legend: {
                            display: yaml.legend,
                            position: yaml.legendPosition
                        }
                    },
                    layout: {
                        padding: yaml.padding
                    }
                }
            };
        }
        return {chartOptions, width: yaml.width};
    }

    /**
     * @param yaml the copied codeblock
     * @returns base64 encoded image in png format
     */
    async imageRenderer(yaml: string, options: ImageOptions): Promise<string> {
        const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
        const destination = document.createElement('canvas');
        const destinationContext = destination.getContext("2d");

        const chartOptions = this.datasetPrep(await parseYaml(yaml.replace("```chart", "").replace("```", "").replace(/\t/g, '    ')));

        new Chart(destinationContext, chartOptions.chartOptions);

        document.body.append(destination);
        await delay(250);
        const dataurl = destination.toDataURL(options.format, options.quality);
        document.body.removeChild(destination);

        return dataurl.substring(dataurl.indexOf(',') + 1);
    }

    renderRaw(data: any, el: HTMLElement): Chart | null {
        const destination = el.createEl('canvas');

        try {
            let chart = new Chart(destination.getContext("2d"), data.chartOptions);
            destination.parentElement.style.width = data.width ?? "100%";
            destination.parentElement.style.margin = "auto";
            return chart;
        } catch (error) {
            renderError(error, el);
            return null;
        }
    }

    renderFromYaml(yaml: any, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        ctx.addChild(new ChartRenderChild(this.datasetPrep(yaml), el, this));
    }
}

class ChartRenderChild extends MarkdownRenderChild {
    data: any;
    chart: null | Chart;
    renderer: Renderer;

    constructor(data: any, el: HTMLElement, renderer: Renderer) {
        super(el);
        this.data = data;
        this.renderer = renderer;
    }

    onload() {
        this.chart = this.renderer.renderRaw(this.data, this.containerEl);
    }

    onunload() {
        this.chart && this.chart.destroy();
        this.chart = null;
    }
}