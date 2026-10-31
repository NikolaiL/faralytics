FaralyticsSans Regular/Bold are derived from Lato; its Black numeric face is derived from Archivo Black.
Sources:
- https://github.com/google/fonts/tree/main/ofl/lato (OFL.txt)
- https://github.com/google/fonts/tree/main/ofl/archivoblack (ARCHIVO-OFL.txt)
The GSUB tables were removed for Satori compatibility, and font names changed to honor reserved names. The intrinsically heavy Archivo Black is registered at weight 900, and is served as FaralyticsNumbers-Black.woff on the web. These older TTFs are retained as legacy assets; OG_FONTS now uses the consistent Archivo family described below. The older Lato-based WOFF remains for existing cached CSS references.

OG_FONTS now uses FaralyticsOG Regular/Bold/Black, all instantiated at width 100 and weights 400/700/900 from the same Archivo variable family: https://github.com/google/fonts/tree/main/ofl/archivo (ARCHIVO-VARIABLE-OFL.txt). GSUB removed for Satori compatibility; internal names changed to FaralyticsOG. This gives mixed-weight labels and numbers matching font metrics. Web numeric typography remains Archivo Black.
