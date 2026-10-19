<?xml version="1.0" encoding="UTF-8"?>
<!--
  edition.xsl: TEI (OpenOrtis) -> HTML fragment with critical apparatus.
  XSLT 1.0, so it runs in the browser (XSLTProcessor) and with xsltproc.

  What it produces
    - edition title, "About this edition" (witnesses, sources, licence)
    - controls: compare witnesses in side-by-side windows, mark variants, show apparatus, filter by
type of variation
    - table of contents
    - the text, with every <app> as a numbered marker
    - an apparatus panel (right-hand column): n. lemma (wits) ] reading (wits)  [type];
      one group of entries per section, the script shows the group of the section being read
    - people and places as links carrying data-id / data-kind, so the script can open a small window

  The wit attributes may be written "#L #Gt" or "L Gt" (both occur in the three files);
  both forms are normalised here.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="http://www.tei-c.org/ns/1.0"
  exclude-result-prefixes="tei">

  <xsl:output method="html" encoding="UTF-8" indent="no" />

  <!-- where the People / Places pages live -->
  <xsl:param name="characters-url" select="'characters.html'" />
  <xsl:param name="places-url" select="'places.html'" />
  <!-- longest lemma/reading shown in an apparatus entry (characters) -->
  <xsl:param name="max-len" select="90" />

  <xsl:key name="wit" match="tei:witness" use="@xml:id" />
  <xsl:key name="ent" match="tei:person|tei:place" use="@xml:id" />
  <!-- places can also be found by name, for placeName elements that use @key instead of @ref -->
  <xsl:key name="entname" match="tei:place" use="normalize-space(tei:placeName)" />
  <xsl:key name="apptype" match="tei:app" use="@type" />

  <!-- ====================================================== page -->
  <xsl:template match="/tei:TEI">
    <div class="edition show-variants">

      <header class="ed-head">
        <h2 class="ed-title">
          <xsl:value-of select="normalize-space(tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:title)" />
        </h2>
        <p class="ed-author">
          <xsl:text>by </xsl:text>
          <xsl:value-of
            select="normalize-space(tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:author)" />
        </p>
        <xsl:call-template name="about" />
      </header>

      <xsl:call-template name="controls" />

      <div class="ed-layout">
        <nav class="toc ed-toc" aria-label="Sections">
          <strong>Sections</strong>
          <xsl:for-each
            select="tei:text/tei:body//*[(self::tei:div1 and @type!='part') or self::tei:div2]">
            <a>
              <xsl:attribute name="href">#<xsl:call-template name="sec-id" /></xsl:attribute>
              <xsl:call-template name="sec-label" />
            </a>
          </xsl:for-each>
        </nav>
        <div class="ed-text">
          <xsl:apply-templates select="tei:text/tei:body/*" />
        </div>
        <aside class="ed-apparatus collapsed" aria-label="Apparatus">
          <button type="button" class="ap-toggle" aria-expanded="false">
            <span class="ap-title">Apparatus</span>
            <span class="ap-sec"></span>
          </button>
          <div class="ap-body">
            <p class="ap-hint">Select a number in the text to find its entry. The entries follow the
    section you are reading.</p>
            <p class="ap-empty" hidden="hidden">No variants in this section.</p>
            <xsl:for-each
              select="tei:text/tei:body//*[(self::tei:div1 and @type!='part') or self::tei:div2][.//tei:app]">
              <xsl:call-template name="app-group" />
            </xsl:for-each>
          </div>
        </aside>
      </div>

    </div>
  </xsl:template>

  <!-- ====================================================== header blocks -->
  <xsl:template name="about">
    <details class="ed-about">
      <summary>About this edition</summary>
      <div class="ed-about-body">

        <h3>Witnesses</h3>
        <dl class="witlist">
          <xsl:for-each select="tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:listWit/tei:witness">
            <dt>
              <xsl:value-of select="@xml:id" />
            </dt>
            <dd>
              <xsl:value-of select="normalize-space(tei:msDesc/tei:msIdentifier/tei:idno)" />
              <xsl:variable name="place"
                select="normalize-space(tei:msDesc/tei:msIdentifier/tei:settlement)" />
              <xsl:variable name="date" select="normalize-space(tei:date)" />
              <xsl:if test="$place or $date">
                <span class="wit-meta">
                  <xsl:text> (</xsl:text>
                  <xsl:value-of select="$place" />
                  <xsl:if test="$place and $date"><xsl:text>, </xsl:text></xsl:if>
                  <xsl:value-of select="$date" />
                  <xsl:text>)</xsl:text>
                </span>
              </xsl:if>
            </dd>
          </xsl:for-each>
        </dl>

        <h3>Sources</h3>
        <ul>
          <xsl:for-each select="tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:bibl">
            <li>
              <strong>
                <xsl:choose>
                  <xsl:when test="@type='printed_source'">Printed source</xsl:when>
                  <xsl:when test="@type='digital_source'">Digital source</xsl:when>
                  <xsl:otherwise>Source</xsl:otherwise>
                </xsl:choose>
              </strong>
              <xsl:text>: </xsl:text>
              <xsl:for-each select="tei:title">
                <em>
                  <xsl:value-of select="normalize-space(.)" />
                </em>
                <xsl:if
                  test="position()!=last()"><xsl:text>, </xsl:text></xsl:if>
              </xsl:for-each>
              <xsl:if test="tei:editor"><xsl:text>, ed. </xsl:text><xsl:value-of
                  select="normalize-space(tei:editor)" /></xsl:if>
              <xsl:if test="tei:publisher"><xsl:text>, </xsl:text><xsl:value-of
                  select="normalize-space(tei:publisher)" /></xsl:if>
              <xsl:if test="tei:pubPlace"><xsl:text>, </xsl:text><xsl:value-of
                  select="normalize-space(tei:pubPlace)" /></xsl:if>
              <xsl:if test="tei:date"><xsl:text>, </xsl:text><xsl:value-of
                  select="normalize-space(tei:date)" /></xsl:if>
              <xsl:text>.</xsl:text>
            </li>
          </xsl:for-each>
        </ul>

        <h3>Credits</h3>
        <p>
          <xsl:value-of
            select="normalize-space(tei:teiHeader/tei:fileDesc/tei:editionStmt/tei:edition)" />
          <xsl:text>. </xsl:text>
          <xsl:value-of
            select="normalize-space(tei:teiHeader/tei:fileDesc/tei:editionStmt/tei:respStmt/tei:resp)" />
          <xsl:text> </xsl:text>
          <xsl:value-of
            select="normalize-space(tei:teiHeader/tei:fileDesc/tei:editionStmt/tei:respStmt/tei:persName)" />
          <xsl:text>.</xsl:text>
        </p>
        <p>
          <xsl:text>Licence: </xsl:text>
          <a
            href="{tei:teiHeader/tei:fileDesc/tei:publicationStmt/tei:availability/tei:licence/@target}"
            target="_blank" rel="noopener">
            <xsl:value-of
              select="normalize-space(tei:teiHeader/tei:fileDesc/tei:publicationStmt/tei:availability/tei:licence)" />
          </a>
        </p>
      </div>
    </details>
  </xsl:template>

  <xsl:template name="controls">
    <section class="ed-controls" aria-label="Reading options">
      <div class="ctl ctl-compare">
        <button type="button" id="add-pane" class="btn">+ Compare in a new window</button>
        <label><input type="checkbox" id="tg-sync" checked="checked" /> Synchronise scrolling</label>
        <!-- list of readings offered by each window; read by the script -->
        <select id="wit-source" hidden="hidden" aria-hidden="true" tabindex="-1">
          <option value="">Edited text (lemma)</option>
          <xsl:for-each select="tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:listWit/tei:witness">
            <option value="{@xml:id}">
              <xsl:value-of select="@xml:id" />
              <xsl:text> &#x2014; </xsl:text>
              <xsl:value-of select="normalize-space(tei:msDesc/tei:msIdentifier/tei:idno)" />
            </option>
          </xsl:for-each>
        </select>
      </div>
      <div class="ctl ctl-toggles">
        <label><input type="checkbox" id="tg-variants" checked="checked" /> Mark variants</label>
        <label><input type="checkbox" id="tg-apparatus" checked="checked" /> Show apparatus</label>
      </div>
      <fieldset class="ctl ctl-types">
        <legend>Types of variation</legend>
        <xsl:for-each select="tei:text//tei:app[generate-id()=generate-id(key('apptype',@type)[1])]">
          <xsl:sort select="@type" />
          <label>
            <input type="checkbox" class="tg-type" value="{@type}" checked="checked" />
            <xsl:text> </xsl:text>
            <xsl:call-template name="type-label">
              <xsl:with-param name="base" select="true()" />
            </xsl:call-template>
            <span class="n"> (<xsl:value-of select="count(key('apptype',@type))" />)</span>
          </label>
        </xsl:for-each>
      </fieldset>
    </section>
  </xsl:template>

  <!-- ====================================================== structure -->
  <xsl:template match="tei:div1[@type='part']">
    <div class="ed-part">
      <xsl:apply-templates select="tei:head" mode="part" />
      <xsl:apply-templates select="*[not(self::tei:head)]" />
    </div>
  </xsl:template>

  <xsl:template match="tei:head" mode="part">
    <h2 class="part-title">
      <xsl:apply-templates />
    </h2>
  </xsl:template>

  <xsl:template match="tei:div1[@type!='part'] | tei:div2">
    <section>
      <xsl:attribute name="class">ed-section <xsl:value-of select="@type" /></xsl:attribute>
      <xsl:attribute name="id"><xsl:call-template name="sec-id" /></xsl:attribute>
      <xsl:attribute name="data-sec"><xsl:call-template name="sec-id" /></xsl:attribute>
      <h2 class="sec-label">
        <xsl:call-template name="sec-label" />
      </h2>
      <xsl:apply-templates />
    </section>
  </xsl:template>

  <!-- continuation of a letter on a new date (Bolognese, letter III) -->
  <xsl:template match="tei:div3">
    <div class="continuation">
      <xsl:apply-templates />
    </div>
  </xsl:template>

  <xsl:template name="sec-id">
    <xsl:choose>
      <xsl:when test="@n"><xsl:value-of select="concat(@type,'-',@n)" /></xsl:when>
      <xsl:otherwise><xsl:value-of select="@type" /></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="sec-label">
    <xsl:choose>
      <xsl:when test="@type='frontespizio'">Title page</xsl:when>
      <xsl:when test="@type='avviso'">Editor&#x2019;s notice</xsl:when>
      <xsl:when test="@type='dedica'">Address to the reader</xsl:when>
      <xsl:when test="@type='epistola'">
        <xsl:text>Letter </xsl:text>
        <xsl:call-template name="roman">
          <xsl:with-param name="n" select="@n" />
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise><xsl:value-of select="@type" /></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="roman">
    <xsl:param name="n" />
    <xsl:choose>
      <xsl:when test="$n=1">I</xsl:when>
      <xsl:when test="$n=2">II</xsl:when>
      <xsl:when test="$n=3">III</xsl:when>
      <xsl:when test="$n=4">IV</xsl:when>
      <xsl:when test="$n=5">V</xsl:when>
      <xsl:when test="$n=6">VI</xsl:when>
      <xsl:when test="$n=7">VII</xsl:when>
      <xsl:when test="$n=8">VIII</xsl:when>
      <xsl:when test="$n=9">IX</xsl:when>
      <xsl:when test="$n=10">X</xsl:when>
      <xsl:when test="$n=11">XI</xsl:when>
      <xsl:when test="$n=12">XII</xsl:when>
      <xsl:otherwise><xsl:value-of select="$n" /></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- ====================================================== text elements -->
  <xsl:template match="tei:head"><p class="orig-head">
      <xsl:apply-templates />
    </p></xsl:template>
  <xsl:template match="tei:opener"><div class="opener">
      <xsl:apply-templates />
    </div></xsl:template>
  <xsl:template match="tei:dateline"><p class="dateline">
      <xsl:apply-templates />
    </p></xsl:template>
  <xsl:template match="tei:closer"><div class="closer">
      <xsl:apply-templates />
    </div></xsl:template>
  <xsl:template match="tei:signed"><p class="signed">
      <xsl:apply-templates />
    </p></xsl:template>
  <xsl:template match="tei:p"><p>
      <xsl:apply-templates />
    </p></xsl:template>
  <xsl:template match="tei:note">
    <aside class="ed-note">
      <span class="ed-note-label">Editorial note</span>
      <xsl:text> </xsl:text>
      <xsl:apply-templates />
    </aside>
  </xsl:template>
  <xsl:template match="tei:hi"><span class="hi hi-{@rend}">
      <xsl:apply-templates />
    </span></xsl:template>
  <xsl:template match="tei:lb"><br class="lb" /></xsl:template>
  <xsl:template match="tei:supplied"><span class="supplied" title="Supplied by the editor">
      <xsl:apply-templates />
    </span></xsl:template>

  <!-- people and places: a link to the People / Places page that the script turns into a small
  window.
       The entry is found by @ref ("#JO") or, for places, by @key matching the name in the header. -->
  <xsl:template match="tei:persName | tei:placeName">
    <xsl:variable name="e"
      select="(key('ent', substring-after(@ref,'#')) | key('entname', normalize-space(@key)))[1]" />
    <xsl:choose>
      <xsl:when test="$e">
        <xsl:variable name="kind">
          <xsl:choose>
            <xsl:when test="$e/self::tei:person">person</xsl:when>
            <xsl:otherwise>place</xsl:otherwise>
          </xsl:choose>
        </xsl:variable>
        <a
          class="ent {local-name()}" data-id="{$e/@xml:id}" data-kind="{$kind}"
          data-name="{normalize-space($e/*[self::tei:persName or self::tei:placeName][1])}">
          <xsl:attribute name="href">
            <xsl:choose>
              <xsl:when test="$e/self::tei:person"><xsl:value-of
                  select="concat($characters-url,'#',$e/@xml:id)" /></xsl:when>
              <xsl:otherwise><xsl:value-of select="concat($places-url,'#',$e/@xml:id)" /></xsl:otherwise>
            </xsl:choose>
          </xsl:attribute>
          <xsl:apply-templates />
        </a>
      </xsl:when>
      <xsl:otherwise><span class="ent {local-name()}">
          <xsl:apply-templates />
        </span></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- ====================================================== apparatus: in the text -->
  <xsl:template match="tei:app">
    <xsl:variable name="n"><xsl:number level="any" from="tei:body" count="tei:app" /></xsl:variable>
    <!-- block-level when the app sits between paragraphs or a reading contains paragraphs -->
    <xsl:variable
      name="tag">
      <xsl:choose>
        <xsl:when
          test="parent::tei:div1 or parent::tei:div2 or parent::tei:div3 or tei:lem/tei:p or tei:rdg/tei:p">
    div</xsl:when>
        <xsl:otherwise>span</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:element
      name="{$tag}">
      <xsl:attribute name="class">app<xsl:if test="$tag='div'"> app-block</xsl:if></xsl:attribute>
      <xsl:attribute
        name="id">app-<xsl:value-of select="$n" /></xsl:attribute>
      <xsl:attribute name="data-n"><xsl:value-of
          select="$n" /></xsl:attribute>
      <xsl:attribute name="data-type"><xsl:value-of select="@type" /></xsl:attribute>
      <xsl:apply-templates
        select="tei:lem|tei:rdg" mode="reading">
        <xsl:with-param name="tag" select="$tag" />
      </xsl:apply-templates>
      <button type="button"
        class="app-mark">
        <xsl:attribute name="aria-label">Variant <xsl:value-of select="$n" />: <xsl:call-template
            name="type-label">
            <xsl:with-param name="base" select="true()" />
          </xsl:call-template> (show in
    apparatus)</xsl:attribute>
        <xsl:value-of select="$n" />
      </button>
    </xsl:element>
  </xsl:template>

  <xsl:template match="tei:lem|tei:rdg" mode="reading">
    <xsl:param name="tag" />
    <xsl:element name="{$tag}">
      <xsl:attribute name="class">reading <xsl:value-of select="local-name()" /></xsl:attribute>
      <xsl:attribute
        name="data-wit"><xsl:text> </xsl:text><xsl:value-of
          select="normalize-space(translate(@wit,'#',' '))" /><xsl:text> </xsl:text></xsl:attribute>
      <xsl:apply-templates />
    </xsl:element>
  </xsl:template>

  <!-- ====================================================== apparatus: entries -->
  <!-- the entries of one section; context node: the section (div1 or div2) -->
  <xsl:template name="app-group">
    <section class="app-group">
      <xsl:attribute name="data-section"><xsl:call-template name="sec-id" /></xsl:attribute>
      <ol class="app-list">
        <xsl:for-each select=".//tei:app">
          <xsl:variable name="n"><xsl:number level="any" from="tei:body" count="tei:app" /></xsl:variable>
          <li
            value="{$n}" id="app-entry-{$n}" data-n="{$n}" data-type="{@type}">
            <xsl:apply-templates select="." mode="entry" />
            <xsl:text> </xsl:text>
            <a class="goto" href="#app-{$n}" title="Show in the text"
              aria-label="Show variant {$n} in the text">&#x2192;</a>
          </li>
        </xsl:for-each>
      </ol>
    </section>
  </xsl:template>

  <!-- one entry:  lemma (wits) ] reading (wits); reading (wits)   [type] -->
  <xsl:template match="tei:app" mode="entry">
    <span class="e-lem">
      <xsl:call-template name="reading-text">
        <xsl:with-param name="r" select="tei:lem" />
      </xsl:call-template>
      <xsl:text> </xsl:text>
      <span class="wits">
        <xsl:call-template name="wits">
          <xsl:with-param name="list" select="normalize-space(translate(tei:lem/@wit,'#',' '))" />
        </xsl:call-template>
      </span>
    </span>
    <span
      class="e-sep"> ] </span>
    <xsl:for-each select="tei:rdg">
      <span class="e-rdg">
        <xsl:call-template name="reading-text">
          <xsl:with-param name="r" select="." />
        </xsl:call-template>
        <xsl:text> </xsl:text>
        <span class="wits">
          <xsl:call-template name="wits">
            <xsl:with-param name="list" select="normalize-space(translate(@wit,'#',' '))" />
          </xsl:call-template>
        </span>
      </span>
      <xsl:if
        test="position()!=last()"><span class="e-semi">; </span></xsl:if>
    </xsl:for-each>
    <span
      class="vtype">
      <xsl:call-template name="type-label" />
    </span>
  </xsl:template>

  <!-- text of a reading, shortened when long; "om." when empty -->
  <xsl:template name="reading-text">
    <xsl:param name="r" />
    <xsl:variable name="s" select="normalize-space($r)" />
    <xsl:choose>
      <xsl:when test="$s=''"><em class="om" title="Not present in these witnesses">om.</em></xsl:when>
      <xsl:when test="string-length($s) &gt; $max-len">
        <span class="e-text">
          <xsl:value-of select="substring($s,1,50)" />
          <xsl:text> &#x2026; </xsl:text>
          <xsl:value-of select="substring($s,string-length($s)-29)" />
        </span>
      </xsl:when>
      <xsl:otherwise><span class="e-text">
          <xsl:value-of select="$s" />
        </span></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- "L Gt" -> <span class="w" title="description">L</span> ... -->
  <xsl:template name="wits">
    <xsl:param name="list" />
    <xsl:if test="string-length($list) &gt; 0">
      <xsl:variable name="first" select="substring-before(concat($list,' '),' ')" />
      <xsl:variable
        name="rest" select="substring-after($list,' ')" />
      <span class="w"
        title="{normalize-space(key('wit',$first)/tei:msDesc/tei:msIdentifier/tei:idno)}">
        <xsl:value-of select="$first" />
      </span>
      <xsl:if test="string-length($rest) &gt; 0"><xsl:text> </xsl:text></xsl:if>
      <xsl:call-template
        name="wits">
        <xsl:with-param name="list" select="$rest" />
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <!-- type of variation (app/@type, app/@subtype); context node: tei:app -->
  <xsl:template name="type-label">
    <xsl:param name="base" select="false()" />
    <xsl:choose>
      <xsl:when test="@type='punctuation'">Punctuation</xsl:when>
      <xsl:when test="@type='capitalisation'">Capitalisation</xsl:when>
      <xsl:when test="@type='orthographic'">Orthographic</xsl:when>
      <xsl:when test="@type='morphological'">Morphological</xsl:when>
      <xsl:when test="@type='lexical'">Lexical</xsl:when>
      <xsl:when test="@type='syntactic'">Word order</xsl:when>
      <xsl:when test="@type='addition'">Addition</xsl:when>
      <xsl:when test="@type='omission'">Omission</xsl:when>
      <xsl:when test="@type='rewriting'">Rewriting</xsl:when>
      <xsl:when test="@type='layout'">Layout</xsl:when>
      <xsl:when test="@type='paratext'">Paratext</xsl:when>
      <xsl:when test="@type='mixed'">
        <xsl:text>Mixed</xsl:text>
        <xsl:if test="@subtype and not($base)">: <xsl:value-of
            select="translate(@subtype,'-','/')" /></xsl:if>
      </xsl:when>
      <xsl:otherwise><xsl:value-of select="@type" /></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>