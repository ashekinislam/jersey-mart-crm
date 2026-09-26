import { Composition } from "remotion";
import { ProductShowcase, calculateMetadata, productShowcaseSchema } from "./ProductShowcase";

const defaultProps = {
  brandName: "Jersey Mart",
  headline: "Custom jerseys, made to order.",
  logoUrl: null,
  voiceoverUrl: "",
  scenes: [{ photoUrl: "", caption: "" }],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ProductShowcase"
      component={ProductShowcase}
      schema={productShowcaseSchema}
      calculateMetadata={calculateMetadata}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
};
