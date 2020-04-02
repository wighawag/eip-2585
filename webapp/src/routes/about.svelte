<script>
	export let post;
</script>

<script context="module">

	export async function preload({ params, query }) {
			const res = await this.fetch(`about.json`);
			const data = await res.json();

			if (res.status === 200) {
				return { post: data };
			} else {
				this.error(res.status, data.message);
			}
		};

</script>

<svelte:head>
	<title>About EIP-2585 / EIP-1776 Demo</title>
</svelte:head>


<div class="markdown">
	{@html post.html}
</div>
