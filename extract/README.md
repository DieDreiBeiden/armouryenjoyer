# extract/ (Phase 1)

Wrapper um `wowsunpack` aus [landaire/wows-toolkit](https://github.com/landaire/wows-toolkit):

```
wowsunpack --game-dir <WoWs> game-params --full data/<build>/GameParams.json
wowsunpack --game-dir <WoWs> extract -o data/<build> content/GameParams.data
wowsunpack --game-dir <WoWs> metadata data/<build>/files.meta
```

Geplant: Build-Nummer erkennen, obige Schritte ausführen, Schema-Check mit `tools/wows_gp`.
