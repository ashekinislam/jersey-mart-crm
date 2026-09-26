import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda-client";
import type { AwsRegion } from "@remotion/lambda-client";
import type { ProductShowcaseProps } from "../../remotion/ProductShowcase";

function remotionConfig() {
  const region = process.env.REMOTION_AWS_REGION;
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  if (!region || !functionName || !serveUrl) {
    throw new Error("not_configured: Remotion Lambda env vars missing");
  }
  return { region: region as AwsRegion, functionName, serveUrl };
}

export async function startVideoRender(
  props: ProductShowcaseProps
): Promise<{ renderId: string; bucketName: string }> {
  const { region, functionName, serveUrl } = remotionConfig();
  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: "ProductShowcase",
    inputProps: props,
    codec: "h264",
    imageFormat: "jpeg",
    maxRetries: 1,
    privacy: "public",
    // A brand-new AWS account's concurrent-Lambda-invocation quota can be
    // very low (even 3 hit "Rate Exceeded" once) -- render fully serially
    // until an AWS quota increase is requested.
    // See https://www.remotion.dev/docs/lambda/troubleshooting/rate-limit
    concurrency: 1,
  });
  return { renderId, bucketName };
}

export interface RenderStatus {
  done: boolean;
  fatalErrorEncountered: boolean;
  errorMessage: string | null;
  outputUrl: string | null;
  overallProgress: number;
}

export async function checkVideoRender(renderId: string, bucketName: string): Promise<RenderStatus> {
  const { region, functionName } = remotionConfig();
  const progress = await getRenderProgress({ renderId, bucketName, functionName, region });
  return {
    done: progress.done,
    fatalErrorEncountered: progress.fatalErrorEncountered,
    errorMessage: progress.errors[0]?.message ?? null,
    outputUrl: progress.outputFile,
    overallProgress: progress.overallProgress,
  };
}
