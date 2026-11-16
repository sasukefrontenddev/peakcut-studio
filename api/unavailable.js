export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res
    .status(503)
    .json({
      detail: "The video engine is being connected. Please try again shortly.",
    });
}
