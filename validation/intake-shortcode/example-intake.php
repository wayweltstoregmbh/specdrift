<?php
/**
 * Plugin Name: Example Intake
 * Description: Generic intake shortcode MVP — static, no external APIs, no database persistence.
 * Version: 0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function example_intake_render() {
	ob_start();
	?>
	<style>
		/* Design tokens: single functional location for colors, radius, spacing, typography. */
		.example-intake-app {
			--ei-color-bg: #f7f6f3;
			--ei-color-surface: #ffffff;
			--ei-color-ink: #1f2933;
			--ei-color-accent: #2f5d50;
			--ei-color-accent-ink: #ffffff;
			--ei-radius: 14px;
			--ei-space: 1.25rem;
			--ei-font: "Segoe UI", system-ui, sans-serif;
			--ei-button-height: 2.75rem;
			--ei-button-font-size: 1rem;
		}
		/* Fullscreen application surface; hides theme chrome while active. */
		.example-intake-app {
			position: fixed;
			inset: 0;
			z-index: 99999;
			overflow-y: auto;
			background: var(--ei-color-bg);
			color: var(--ei-color-ink);
			font-family: var(--ei-font);
			padding: calc(var(--ei-space) * 2);
		}
		body.example-intake-active .site-header,
		body.example-intake-active .site-footer,
		body.example-intake-active header.wp-block-template-part,
		body.example-intake-active footer.wp-block-template-part,
		body.example-intake-active .entry-title,
		body.example-intake-active .wp-site-blocks > header,
		body.example-intake-active .wp-site-blocks > footer {
			display: none;
		}
		.example-intake-card {
			max-width: 40rem;
			margin: 0 auto;
			background: var(--ei-color-surface);
			border-radius: var(--ei-radius);
			padding: calc(var(--ei-space) * 1.6);
			box-shadow: 0 18px 40px rgba(31, 41, 51, 0.08);
		}
		/* Text-size hierarchy: hero title large, explanatory copy small. */
		.example-intake-hero-label { font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; }
		.example-intake-hero-title { font-size: 2rem; margin: 0.25rem 0 1rem; }
		.example-intake-field { display: block; margin-bottom: var(--ei-space); }
		.example-intake-field span { display: block; margin-bottom: 0.35rem; font-weight: 600; }
		.example-intake-field input,
		.example-intake-field select,
		.example-intake-field textarea {
			width: 100%;
			padding: 0.65rem;
			border: 1px solid #d4d0c8;
			border-radius: calc(var(--ei-radius) / 2);
			font-family: var(--ei-font);
			font-size: 1rem;
		}
		/* Action group: compatible height, font family, font size and alignment for all buttons. */
		.example-intake-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
		.example-intake-actions button {
			height: var(--ei-button-height);
			font-family: var(--ei-font);
			font-size: var(--ei-button-font-size);
			border-radius: calc(var(--ei-radius) / 2);
			padding: 0 1.2rem;
			cursor: pointer;
		}
		.example-intake-primary {
			background: var(--ei-color-accent);
			color: var(--ei-color-accent-ink);
			border: 1px solid var(--ei-color-accent);
		}
		.example-intake-secondary {
			background: var(--ei-color-surface);
			color: var(--ei-color-accent);
			border: 1px solid var(--ei-color-accent);
		}
		.example-intake-result { display: none; margin-top: var(--ei-space); padding: var(--ei-space);
			border: 1px solid var(--ei-color-accent); border-radius: calc(var(--ei-radius) / 2); }
		.example-intake-result.is-visible { display: block; }
	</style>
	<div class="example-intake-app">
		<div class="example-intake-card">
			<p class="example-intake-hero-label">Example Product</p>
			<h1 class="example-intake-hero-title">Intake Request</h1>
			<form id="example-intake-form">
				<label class="example-intake-field"><span>Name</span>
					<input type="text" name="intake_name" required></label>
				<label class="example-intake-field"><span>E-Mail</span>
					<input type="email" name="intake_email" required></label>
				<label class="example-intake-field"><span>Kategorie</span>
					<select name="intake_category">
						<option>Allgemeine Anfrage</option>
						<option>Technisches Problem</option>
						<option>Feedback</option>
					</select></label>
				<label class="example-intake-field"><span>Anliegen</span>
					<textarea name="intake_message" rows="5" required></textarea></label>
				<div class="example-intake-actions">
					<button type="submit" class="example-intake-primary">Einschätzung anfordern</button>
					<button type="button" class="example-intake-secondary" id="example-intake-status">Status prüfen</button>
					<button type="button" class="example-intake-secondary" id="example-intake-details">Details anzeigen</button>
				</div>
			</form>
			<div class="example-intake-result" id="example-intake-result" role="status">
				<p class="example-intake-success">Vielen Dank! Ihre Anfrage wurde aufgenommen.</p>
				<p>Referenznummer: <strong id="example-intake-reference"></strong></p>
				<p>Status: <strong>Browser-Test aktiv</strong></p>
				<p class="example-intake-next">Nächster Schritt: Ein interner Reviewer sichtet Ihre Angaben.
					Sie erhalten eine Einschätzung unter der angegebenen E-Mail-Adresse.</p>
			</div>
		</div>
	</div>
	<script>
	(function () {
		document.body.classList.add("example-intake-active");
		var form = document.getElementById("example-intake-form");
		form.addEventListener("submit", function (event) {
			/* In-place update: the interaction must not reload the page. */
			event.preventDefault();
			var reference = "EI-" + Date.now().toString(36).toUpperCase();
			document.getElementById("example-intake-reference").textContent = reference;
			document.getElementById("example-intake-result").classList.add("is-visible");
		});
		document.getElementById("example-intake-status").addEventListener("click", function () {
			var current = document.getElementById("example-intake-reference").textContent;
			window.alert(current
				? "Status für " + current + ": Browser-Test aktiv"
				: "Noch keine Anfrage übermittelt.");
		});
		document.getElementById("example-intake-details").addEventListener("click", function () {
			window.alert("Diese MVP-Demo speichert nichts und sendet keine E-Mails.");
		});
	})();
	</script>
	<?php
	return ob_get_clean();
}
add_shortcode( 'example_intake', 'example_intake_render' );
