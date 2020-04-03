import fs from 'fs';
import path from 'path';
import marked from 'marked';

function process_markdown(markdown) {
	const metadata = {};
	let content;
	const match = /---\r?\n([\s\S]+?)\r?\n---/.exec(markdown);
	if (match) {
		const frontMatter = match.length > 1 ? match[1] : undefined;	
		if (frontMatter) {
			frontMatter.split('\n').forEach(pair => {
				const colonIndex = pair.indexOf(':');
				metadata[pair.slice(0, colonIndex).trim()] = pair
					.slice(colonIndex + 1)
					.trim();
			});
		}
		content = markdown.slice(match[0].length);
	} else {
		content = markdown.slice(markdown);
	}
	
	return { metadata, content };
}

function getPost() {
	const file = `../README.md`;
	if (!fs.existsSync(file)) return null;

	const markdown = fs.readFileSync(file, 'utf-8');

	const { content, metadata } = process_markdown(markdown);

	if (metadata.pubdate) {
		const date = new Date(`${metadata.pubdate} EDT`); // cheeky hack
		metadata.dateString = date.toDateString();
	}
	
	const html = marked(content);

	return {
		metadata,
		html
	};
}

let article;

export function get(req, res, next) {
	
	if (process.env.NODE_ENV !== 'production' || !article) {
		const post = getPost();
		article = JSON.stringify(post);
	}
	
	const json = article;

	if (json) {
		res.writeHead(200, {
			'Content-Type': 'application/json'
		});

		res.end(json);
	} else {
        console.log('json not found');
		res.writeHead(404, {
			'Content-Type': 'application/json'
		});

		res.end(JSON.stringify({
			message: `Not found`
		}));
	}
}