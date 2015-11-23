import Ember from 'ember';
import ChartComponent from './chart-component';
import FormattableMixin from '../mixins/formattable';

import FloatingTooltipMixin from '../mixins/floating-tooltip';
import SortableChartMixin from '../mixins/sortable-chart';
import LabelWidthMixin from '../mixins/label-width';

import LabelTrimmer from '../utils/label-trimmer';

export default ChartComponent.extend(FloatingTooltipMixin,
  FormattableMixin, SortableChartMixin, LabelWidthMixin, {
  classNames: ['chart-horizontal-bar'],

  // ----------------------------------------------------------------------------
  // Horizontal Bar Chart Options
  // ----------------------------------------------------------------------------

  // Minimum height of the whole chart, including padding
  defaultOuterHeight: 500,

  // Space between label and zeroline (overrides ChartView)
  // Also used to pad labels against the edges of the viewport
  labelPadding: 20,

  // Space between adjacent bars, as fraction of padded bar size
  barPadding: 0.2,

  // Constraints on size of each bar
  maxBarThickness: 60,
  minBarThickness: 20,

  // ----------------------------------------------------------------------------
  // Data
  // ----------------------------------------------------------------------------

  finishedData: Ember.computed.alias('sortedData'),

  // Checks xDomain to see if there is negative data
  hasNegativeData: Ember.computed('xDomain', function(){
    return (this.get('xDomain')[0] < 0);
  }),

  // Checks xDomain to see if there is positive data
  hasPositiveData: Ember.computed('xDomain', function(){
    return (this.get('xDomain')[1] > 0);
  }),

  // ----------------------------------------------------------------------------
  // Layout
  // ----------------------------------------------------------------------------

  /**
  * @override
  * Overrides values in addon/mixins/axis-titles.js
  */
  xAxisPositionX: Ember.computed('graphicWidth', 'labelWidthOffset', function(){
    return (this.get('hasNegativeData') && this.get('hasPositiveData')) ? this.get('xScale')(0) : (this.get('graphicWidth') / 2);
  }),

  /**
  * @override
  * X Axis Titles needs some extra padding or else it will intersect with the lowest bar
  * TO-DO: Change the 20px padding to be a variable that can be referenced elsewhere
  */
  xAxisPositionY: Ember.computed('graphicBottom', 'axisPadding', function(){
    return this.get('graphicBottom') + 15;
  }),

  /**
  * @override
  */
  yAxisPositionX: Ember.computed('graphicBottom', 'axisPadding', function(){
    return -(this.get('graphicHeight') / 2);
  }),

  /**
  * @override
  */
  yAxisPositionY: Ember.computed('labelWidthOffset', function(){
    return -(this.get('labelWidthOffset'));
  }),

  /**
  * @override
  * Horizontal Bar Charts require that marginLeft be dependent on 'horizontalMargin'
  * Otherwise, without override will result in marginLeft ~= 0 (axis location will always be flush on the left)
  */
  marginLeft: Ember.computed('hasAxisTitles', 'horizontalMarginLeft', 'horizontalMargin', function(){
     return this.get('hasAxisTitles') ? this.get('horizontalMarginLeft') + this.get('horizontalMargin'): this.get('horizontalMargin');
  }),

  // marginLeft: Ember.computed('hasAxisTitles', function() {
  //   //alert(this.get('graphicLeft'));
  //   return 10*this.getGroupingPadding();
  // }),
  // marginRight: 0,

  /**
  * @override
  * Anchoring using 'middle' looks better visually than using 'start'
  */
  updateYAxisTitle: function(){
    this.get('yAxisTitle')
    .text(this.get('yAxisTitleDisplayValue'))
    .style('text-anchor', 'middle').attr({
      x: this.get('yAxisPositionX'),
      y: this.get('yAxisPositionY'),
    }).attr("transform", this.get('yAxisTransform'))
    .attr("dy", "1em");
  },

  minOuterHeight: Ember.computed('numBars', 'minBarThickness', 'marginTop', 'marginBottom', function() {
    const minBarThickness = this.get('minBarThickness');
    // If minBarThickness is null or undefined, do not enforce minOuterHeight.
    if (Ember.isNone(minBarThickness)) {
      return null;
    } else {
      const minBarSpace = this.get('numBars') * minBarThickness;
      return minBarSpace + this.get('marginTop') + this.get('marginBottom');
    }
  }),

  maxOuterHeight: Ember.computed('numBars', 'maxBarThickness', 'marginTop', 'marginBottom', function() {
    const maxBarThickness = this.get('maxBarThickness');
    // If maxBarThickness is null or undefined, do not enforce maxOuterHeight.
    if (Ember.isNone(maxBarThickness)) {
      return null;
    } else {
      const maxBarSpace = this.get('numBars') * maxBarThickness;
      return maxBarSpace + this.get('marginTop') + this.get('marginBottom');
    }

  }),

  // override the default outerHeight, so the graph scrolls
  outerHeight: Ember.computed('minOuterHeight', 'maxOuterHeight', 'defaultOuterHeight', function() {
    // Note: d3.max and d3.min ignore null/undefined values
    var maxMinDefault = d3.max([this.get('defaultOuterHeight'), this.get('minOuterHeight')]);
    return d3.min([maxMinDefault, this.get('maxOuterHeight')]);
  }),

  marginTop: Ember.computed.alias('labelPadding'),
  marginBottom: Ember.computed.alias('labelPadding'),

  horizontalMargin: Ember.computed.readOnly('labelWidth'),

  // horizontalMargin: Ember.computed('finishedData', function() {
  //    //alert(this.get('graphicLeft'));
  //    //alert(this.getGroupingPadding());
  //    //return 10*this.getGroupingPadding();

  //    if (this.get('hasPositiveData') && this.get('hasNegativeData')) {
  //      return this.get('labelWidth');
  //    } else if (this.get('hasPositiveData')) {
  //      return 11*this.getGroupingPadding();
  //    } else {
  //      alert('gothere');
  //      return 11*this.getValuePadding();
  //    }
  // }),


  // ----------------------------------------------------------------------------
  // Graphics Properties
  // ----------------------------------------------------------------------------

  numBars: Ember.computed.alias('finishedData.length'),

  // Range of values used to size the graph, within which bars will be drawn
  xDomain: Ember.computed('finishedData', 'xDomainPadding', function() {
    var values = this.get('finishedData').map(function(d) { return d.value; });
    var minValue = d3.min(values);
    var maxValue = d3.max(values);

    //Set the Domain to use up the chart space fficiently
    if (minValue < 0 && maxValue > 0) {
      var absMax = Math.max(-minValue, maxValue);
      return [-absMax, absMax];
    } else if (minValue < 0 && maxValue <= 0) {
      return [minValue, 0];
    } else {
      return [0, maxValue];
    }
  }),


  // Calculates the padding for grouping labels
  // Accounts for the largest label in the chart
  getGroupingPadding: function() {
    //alert("here");
    var maxGroupingLength = d3.max(this.get('finishedData').map(function(d) { return d.label.length;  }));
    var groupingPadding = 0;
    if (maxGroupingLength < 25) {
      groupingPadding = maxGroupingLength * Math.pow(0.987, maxGroupingLength);
    } else if (maxGroupingLength < 50) {
      groupingPadding = maxGroupingLength * Math.pow(0.99, maxGroupingLength)-1;
    } else {
      groupingPadding = maxGroupingLength * Math.pow(0.993, maxGroupingLength)-3;
    }
    return groupingPadding;
  },

  // Calculates the padding for value labels
  // Defaults to rounding to the hundreths place
  getValuePadding: function(val) {
    return (Math.round(100 * val) / 100).toString().length;
  },

  // Returns the appropriate scaled X values
  // Accounts for value and grouping label paddings on the left and the right.
  xScaleFunc: function(x) {
    var fontPixelSize = 11;
    var minBuffer = 7;
    var groupingPadding = this.getGroupingPadding();
    var valuePadding = this.getValuePadding(x);

    var padding = fontPixelSize * Math.max((this.get('hasPositiveData') ? valuePadding : groupingPadding), minBuffer);
    var finalWidth = this.get('outerWidth') - this.get('labelWidth') - padding;

    // if (x != 0) {
    //   alert("finalWidth: " + finalWidth);
    // }
    return d3.scale.linear()
    .domain(this.get('xDomain'))
    .range([0, finalWidth])
    .nice()(x);
  },

  // Scale to map value to horizontal length of bar
  // Keeping this name since all the drawing functions in this file use it
  xScale: Ember.computed('width', 'xDomain', function() {
    return (x) => this.xScaleFunc(x);
  }),

  // Scale to map bar index to its horizontal position
  yScale: Ember.computed('height', 'barPadding', function() {
    // Evenly split up height for bars with space between bars
    return d3.scale.ordinal()
      .domain(d3.range(this.get('numBars')))
      .rangeRoundBands([0, this.get('height')], this.get('barPadding'));
  }),

  // Space in pixels allocated to each bar + padding
  barThickness: Ember.computed('yScale', function() {
    return this.get('yScale').rangeBand();
  }),

  // ----------------------------------------------------------------------------
  // Tooltip Configuration
  // ----------------------------------------------------------------------------

  showDetails: Ember.computed('isInteractive', function() {
    if (!this.get('isInteractive')) {
      return Ember.K;
    }

    return (data, i, element) => {
      // Do hover detail style stuff here
      d3.select(element).classed('hovered', true);

      // Show tooltip
      var formatLabel = this.get('formatLabelFunction');
      // Line 1
      var content = "<span class=\"tip-label\">" + data.label + "</span>";
      // Line 2
      content += "<span class=\"name\">" + this.get('tooltipValueDisplayName') + ": </span>";
      content += "<span class=\"value\">" + formatLabel(data.value) + "</span>";
      return this.showTooltip(content, d3.event);
    };
  }),

  hideDetails: Ember.computed('isInteractive', function() {
    if (!this.get('isInteractive')) {
      return Ember.K;
    }

    return (data, i, element) => {
      // Undo hover style stuff
      d3.select(element).classed('hovered', false);
      // Hide Tooltip
      return this.hideTooltip();
    };
  }),

  // ----------------------------------------------------------------------------
  // Styles
  // ----------------------------------------------------------------------------

  groupAttrs: Ember.computed('xScale', 'yScale', function() {
    var xScale = this.get('xScale');
    var yScale = this.get('yScale');
    return {
      transform: function(d, i) {
        var value = Math.min(0, d.value);
        return "translate(" + xScale(value) + ", " + yScale(i) + ")";
      }
    };
  }),

  barAttrs: Ember.computed('xScale', 'mostTintedColor', 'leastTintedColor', 'barThickness', function() {
    var xScale = this.get('xScale');
    return {
      width: (d) => Math.abs(xScale(d.value) - xScale(0)),
      height: this.get('barThickness'),
      'stroke-width': 0,
      style: (d) => {
        if (d.color) {
          return "fill:" + d.color;
        }
        var color = (d.value < 0) ? this.get('mostTintedColor') : this.get('leastTintedColor');
        return "fill:" + color;
      }
    };
  }),

  valueLabelAttrs: Ember.computed('xScale', 'barThickness', 'labelPadding', function() {
    var xScale = this.get('xScale');
    // Anchor the label 'labelPadding' away from the zero line
    // How to anchor the text depends on the direction of the bar
    return {
      x: (d) => {
        if (d.value < 0) {
          return -this.get('labelPadding');
        } else {
          return xScale(d.value) - xScale(0) + this.get('labelPadding');
        }
      },
      y: this.get('barThickness') / 2,
      dy: '.35em',
      'text-anchor': (d) => d.value < 0 ? 'end' : 'start',
      'stroke-width': 0
    };
  }),

  groupLabelAttrs: Ember.computed('xScale', 'barThickness', 'labelPadding', function() {
    var xScale = this.get('xScale');

    // Anchor the label 'labelPadding' away from the zero line
    // How to anchor the text depends on the direction of the bar
    return {
      x: (d) => {
        if (d.value < 0) {
          return xScale(0) - xScale(d.value) + this.get('labelPadding');
        } else {
          return -this.get('labelPadding');
        }
      },
      y: this.get('barThickness') / 2,
      dy: '.35em',
      'text-anchor': (d) => d.value < 0 ? 'start' : 'end',
      'stroke-width': 0
    };
  }),

  axisAttrs: Ember.computed('xScale', 'height', function() {
    var xScale = this.get('xScale');

    // Thickness, counts the padding allocated to each bar as well
    return {
      x1: xScale(0),
      x2: xScale(0),
      y1: 0,
      y2: this.get('height')
    };
  }),

  // ----------------------------------------------------------------------------
  // Selections
  // ----------------------------------------------------------------------------

  groups: Ember.computed(function() {
    return this.get('viewport')
      .selectAll('.bar')
      .data(this.get('finishedData'));
  }).volatile(),

  yAxis: Ember.computed(function() {
    var yAxis = this.get('viewport').select('.y.axis line');
    if (yAxis.empty()) {
      return this.get('viewport')
        .insert('g', ':first-child')
        .attr('class', 'y axis')
        .append('line');
    } else {
      return yAxis;
    }
  }).volatile(),

  // ----------------------------------------------------------------------------
  // Drawing Functions
  // ----------------------------------------------------------------------------

  renderVars: [
    'barThickness',
    'yScale',
    'finishedData',
    'colorRange'
  ],

  drawChart: function() {
    this.updateData();
    this.updateAxes();
    this.updateGraphic();
  },

  updateData: function() {
    var groups = this.get('groups');
    var showDetails = this.get('showDetails');
    var hideDetails = this.get('hideDetails');

    var entering = groups.enter()
      .append('g').attr('class', 'bar')
      .on("mouseover", function(d, i) { return showDetails(d, i, this); })
      .on("mouseout", function(d, i) { return hideDetails(d, i, this); });
    entering.append('rect');
    entering.append('text').attr('class', 'value');
    entering.append('text').attr('class', 'group');

    return groups.exit().remove();
  },

  updateAxes: function() {
    return this.get('yAxis').attr(this.get('axisAttrs'));
  },

  updateGraphic: function() {
    var groups = this.get('groups')
      .attr(this.get('groupAttrs'));

    groups.select('rect')
      .attr(this.get('barAttrs'));

    groups.select('text.value')
      .text((d) => this.get('formatLabelFunction')(d.value))
      .attr(this.get('valueLabelAttrs'));

    //Ensures that groupingLabels won't get truncated when changing the labelWidthMultiplier
    var labelWidth = this.get('hasNegativeData') ? this.get('outerWidth') * 0.35 : this.get('labelWidth');
    var labelTrimmer = LabelTrimmer.create({
      getLabelSize: () => labelWidth,
      getLabelText: (d) => d.label
    });

    return groups.select('text.group')
      .text((d) => d.label)
      .attr(this.get('groupLabelAttrs'))
      .call(labelTrimmer.get('trim'));
  }
});
