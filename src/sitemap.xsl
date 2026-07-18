<?xml version="1.0" encoding="UTF-8"?>
<!--
  Feuille de style cosmétique pour sitemap.xml : rend une table HTML lisible
  quand on ouvre le sitemap dans un navigateur. Ignorée par les crawlers.
-->
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <title>Offtoon - Sitemap</title>
        <meta name="robots" content="noindex"/>
        <style>
          :root { color-scheme: light dark; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
                 margin: 2rem auto; max-width: 60rem; padding: 0 1rem;
                 background: #121212; color: #eaeaea; }
          h1 { font-size: 1.4rem; margin-bottom: .25rem; }
          p.count { color: #9a9a9a; margin-top: 0; }
          table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
          th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid #2a2a2a; }
          th { color: #9a9a9a; font-weight: 600; font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; }
          a { color: #6ea8fe; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>Offtoon - Sitemap</h1>
        <p class="count"><xsl:value-of select="count(s:urlset/s:url)"/> URLs</p>
        <table>
          <tr><th>URL</th><th>Last modified</th><th>Change freq.</th><th>Priority</th></tr>
          <xsl:for-each select="s:urlset/s:url">
            <tr>
              <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
              <td><xsl:value-of select="s:lastmod"/></td>
              <td><xsl:value-of select="s:changefreq"/></td>
              <td><xsl:value-of select="s:priority"/></td>
            </tr>
          </xsl:for-each>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
