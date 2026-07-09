import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, BatchSpanProcessor, ConsoleSpanExporter, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, ATTR_SERVICE_NAMESPACE } from '@opentelemetry/semantic-conventions';

export class OpenTelemetryRuntime {
  private static provider: NodeTracerProvider | null = null;
  private static exporter: SpanExporter | null = null;
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) {
      return;
    }

    const serviceName = process.env.OTEL_SERVICE_NAME || 'url-normalizer';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || '0.1.0';
    const serviceNamespace = 'url-normalizer-ns';

    const resourceAttributes: Record<string, string> = {
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      [ATTR_SERVICE_NAMESPACE]: serviceNamespace,
    };

    if (process.env.OTEL_RESOURCE_ATTRIBUTES) {
      const parts = process.env.OTEL_RESOURCE_ATTRIBUTES.split(',');
      for (const part of parts) {
        const [key, val] = part.split('=');
        if (key && val) {
          resourceAttributes[key.trim()] = val.trim();
        }
      }
    }

    const resource = resourceFromAttributes(resourceAttributes);

    this.exporter = new ConsoleSpanExporter();

    const isProduction = process.env.NODE_ENV === 'production';
    const spanProcessor = isProduction
      ? new BatchSpanProcessor(this.exporter)
      : new SimpleSpanProcessor(this.exporter);

    this.provider = new NodeTracerProvider({
      resource,
      spanProcessors: [spanProcessor]
    });
    this.provider.register();

    this.initialized = true;
  }

  public static async forceFlush(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.forceFlush();
      } catch (err) {
        // Tracing is best effort
      }
    }
  }

  public static async shutdown(): Promise<void> {
    if (this.provider) {
      try {
        await this.provider.shutdown();
      } catch (err) {
        // Tracing is best effort
      } finally {
        this.provider = null;
        this.exporter = null;
        this.initialized = false;
      }
    }
  }

  public static isInitialized(): boolean {
    return this.initialized;
  }

  public static getProvider(): NodeTracerProvider | null {
    return this.provider;
  }

  public static getExporter(): SpanExporter | null {
    return this.exporter;
  }
}
