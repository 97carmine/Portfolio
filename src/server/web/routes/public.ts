import { Request, Response, Router } from "express";
import { renderToString } from "react-dom/server";
import { matchPath } from "react-router";
import { minify } from "html-minifier-terser";
import { readFileSync } from "fs";
import { join } from "path";
import app from "../components/app";
import routes from "../../../common/routes";

const publicRoute: Router = Router();

publicRoute.get("/*", async (req: Request, res: Response): Promise<void> => {
	const activeRoute = routes.find((route) => matchPath(req.path, route));

	res.render(
		"public",
		{
			assets: JSON.parse(readFileSync(join(__dirname, "static/asset-manifest.json"), "utf-8")),
			language: req.language.locale,
			canonical_URL: req.fullURL.toString(),
			component: renderToString(app(req.path, req.language)),
			description: req.language.formatMessage(
				{ id: "1cf05", defaultMessage: "{name}'s portfolio" },
				{ name: "Axel Gabriel Calle Granda" }
			),
			humans_URL: new URL(`humans.txt`, `${req.protocol}://${req.get("host")}`).toString(),
			noJS: req.language.formatMessage({
				id: "2ce4c",
				defaultMessage: "You need to activate JavaScript for full functionality",
			}),
		},
		(error: Error, html: string): void => {
			if (error) {
				res.status(500).render("500", {
					language: req.language.locale,
					message: req.language.formatMessage({
						id: "1a303",
						defaultMessage: "Wow, something's broken, I recommend you come back later.",
					}),
				});
			} else {
				const minified_html: string = minify(html, {
					collapseWhitespace: true,
					removeRedundantAttributes: true,
					removeScriptTypeAttributes: true,
					removeStyleLinkTypeAttributes: true,
					removeAttributeQuotes: true,
					removeComments: true,
					sortAttributes: true,
					sortClassName: true,
					useShortDoctype: true,
					minifyJS: true,
					minifyCSS: true,
					minifyURLs: true,
				});

				activeRoute === undefined ? res.status(404).send(minified_html) : res.send(minified_html);
			}
		}
	);
});

export default publicRoute;
