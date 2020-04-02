<script>
	import Tailwindcss from '../components/Tailwindcss.svelte';
	import Nav from '../components/Nav.svelte';

	export let segment;
</script>

<Tailwindcss />

<style global >
	.button {
		/* hover:text-white hover:bg-purple-500 */
		@apply text-purple-500 border border-purple-500 text-xs font-semibold rounded-full px-4 py-1 leading-normal
	}

	/* .disabled {
		@apply cursor: none; and opacity: 50%;
	} */

/* purgecss start ignore */
	/* Markdown Styles */
	/* Global */
	.markdown {
	@apply leading-relaxed text-lg;
	}
	/* Headers */
	.markdown h1,
	.markdown h2 {
	@apply text-2xl my-6 font-bold;
	}
	.markdown h3,
	.markdown h4,
	.markdown h5,
	.markdown h6 {
	@apply text-xl my-3 font-semibold;
	}
	/* Links */
	.markdown a {
	@apply text-blue-600;
	}
	.markdown a:hover {
	@apply underline;
	}
	/* Paragraph */
	.markdown p {
	@apply mb-4;
	}
	/* Lists */
	.markdown ul,
	.markdown ol {
	@apply mb-4 ml-8;
	}
	.markdown li > p,
	.markdown li > ul,
	.markdown li > ol {
	@apply mb-0;
	}
	.markdown ol {
	@apply list-decimal;
	}
	.markdown ul {
	@apply list-disc;
	}
	/* Blockquotes */
	.markdown blockquote {
	@apply p-0 p-2 mx-6 bg-gray-100 mb-4 border-l-4 border-gray-400 italic;
	}
	.markdown blockquote > p {
	@apply mb-0;
	}
	/* Tables */
	.markdown td,
	.markdown th {
	@apply px-2 py-1 border border-gray-400;
	}
	.markdown tr:nth-child(odd) {
	@apply bg-gray-100;
	}
	.markdown table {
	@apply mb-6;
	}
/* purgecss end ignore */
</style>

<Nav {segment}/>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<slot></slot>
</div>