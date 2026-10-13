# CampusCycle — project report

Mid-semester project report for **UCS 503 Software Engineering**, written
against the TIET report template (`tietreport.cls`).

## Files

| File | Purpose |
|---|---|
| `main.tex` | The report. Four chapters plus bibliography. |
| `references.bib` | Bibliography database (13 entries, all cited). |
| `tietreport.cls` | The institute template class, copied here so this folder compiles on its own. |
| `figures/` | Five vector diagrams (PDF) and five interface screenshots (PNG). |
| `CampusCycle-Report-preview.pdf` | A rendered preview — see the note below. |

## Before submitting — fill in three fields

Near the top of `main.tex`:

- the two roll numbers (currently `102XXXXXXX`),
- the group number (currently `XXXX`),
- the faculty advisor's name.

Check the evaluation period in `\TitlePageFooterText` too; it is set to
*Mid-Semester Evaluation*.

## Compiling

**Overleaf** (simplest): upload this whole folder, set the main document to
`main.tex`, and compile. Overleaf's default is pdfLaTeX with Biber, which is
what the template expects.

**Locally**, with a TeX Live installation that includes `biblatex` and `biber`:

```bash
latexmk -pdf main.tex
```

> **About the preview PDF.** `CampusCycle-Report-preview.pdf` was produced from
> this exact source except for one substitution: the build environment had no
> `biber`, so the bibliography was rendered with classic BibTeX instead of
> biblatex. Everything else — layout, figures, tables, cross-references — is
> identical. Compiling `main.tex` as above gives the same document with the
> template's alphabetic citation style.

## Replacing the campus map screenshot

`figures/ui-student-map.png` was captured on a machine without internet access,
so the OpenStreetMap basemap tiles are blank behind the station markers. If you
re-take that screenshot on your own machine (sign in as a student, open
**Campus Map**, capture the page) and save it over that file with the same
name, the report picks it up with no other change. The caption currently
explains the blank tiles; drop that sentence if you replace the image.
