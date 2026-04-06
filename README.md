# itfactor-site

## IndexNow
After deployment, submit updated indexable URLs manually:

```bash
./scripts/indexnow-submit.sh \
  https://itfactor.studio/ \
  https://itfactor.studio/pricing/ \
  https://itfactor.studio/guides/
```

You can also pass a text file or pipe URLs on stdin:

```bash
./scripts/indexnow-submit.sh urls.txt
printf '%s\n' "https://itfactor.studio/" | ./scripts/indexnow-submit.sh
```

Do not submit the noindex redirect pages `/PrivacyPolicy.html` and `/TermsOfService.html`.
