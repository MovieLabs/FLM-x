#!/usr/bin/perl
#
# The MIT License (MIT)
# 
# Original Library 
#   - Copyright (c) MovieLabs 2015
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
# 
# @author Paul Jensen <pgj@movielabs.com>
#
# PERL script to generate an FLM instance document based on a template file
# and a set of substitution variables.
#
# Usage: flmgen.pl -i input-file -o output-file -n auditoriums [template-file]
# where
#   -i specifies the substitution parameter file
#   -o specifies the output XML document (based on template + substitutions)
#   -n specifies the number of auditoriums
#   -t template-file is a template instance document (default TEMPLATE.xml)
#
# Parameter substitution variables start with a double underscore "__".  Some
# are defined and new ones can be created as needed.  Parameter variables
# starting with a triple underscore are reserved for the system 
#
# Current parameters defined (and corresponding XML in default template):
#
# __FACILITY_NAME: flm:FacilityName
# __FACILITY_ID: flm:FacilityID
# __TZ: flm:FacilityTimeZone
# __CIRCUIT: flm:Circuit
# __CONTACT_NAME: flm:Name
# __CONTACT_CC: flm:Contact/flm:CountryCode
# __CONTACT_Phone: flm:Phone1
# __CONTACT_Email: flm:Emailo
# __CONTACT_Type flm:Type
# __ADDR_PHY_SA: flm:StreetAddress>
# __ADDR_PHY_CITY: flm:City
# __ADDR_PHY_PROVINCE: flm_Province
# __ADDR_PHY_POSTAL: flm:PostalCode
# __ADDR_PHY_CC=US: flm:Physical/flm:Country
#
# System parameter substitutions:
#
# ___UUID: returns a UUID (via uuidgen)
# ___AUDNUM: returns the current auditorium (between 1..-n)
# ___RAND_a_b: returns a random number a <= x <= b
#

my $flm_hdr;
my $flm_auditorium;
my $flm_tail;

use POSIX;
use Getopt::Std;
my %subs;
my %opts;
my $audnum = 0;
my $template_file = "./TEMPLATE.xml";

sub substitute {
    my $k = $_[0];
    my $ret;

    if ($k eq "___UUID") {
        $ret = "urn:uuid:" . `uuidgen`;
        chomp $ret;
    } elsif ($k eq "___AUDNUM") {
        $ret = ++$audnum;
    } elsif ($k =~ /___RAND_(\d+)_(\d+)/) {
        $ret = floor(rand($2 - $1) + $1);
    } else {
        $ret = $subs{$k};
    }
    return $ret;
}

getopts("i:n:o:t:", \%opts);

die "missing option -i" if ($opts{"i"} =~ /^\s*$/);
die "missing option -n" if ($opts{"n"} =~ /^\s*$/);
die "missing option -o" if ($opts{"o"} =~ /^\s*$/);
$template_file = $opts{"t"} if ($opts{"t"} ne "");

open(FILE, $template_file) || die "can't open $template_file";
my $accum;
my $chunk = 0;
while (<FILE>) {
    if (/___BREAK/) {
        $chunk++;
        if ($chunk == 1) {
            $flm_hdr = $accum;
            $accum = "";
        } elsif ($chunk == 2) {
            $flm_auditorium = $accum;
            $accum = "";
        } else {
            die "shouldn't get here $chunk";
        }
    } else {
        $accum .= $_;
    }
}
close(FILE);
$flm_tail = $accum;

open(FILE, "<$opts{'i'}") || die "can't open $opts{'i'}";
while (<FILE>) {
    next if (/^#/);
    s/\s+$//; # trailing whitespace
    chomp;
    if (/(__[A-Za-z0-9_]+)=(.*)$/) {
        $subs{$1}=$2;
    } else {
        die "can't parse: $_";
    }
}
close(FILE);

open(OFILE, ">$opts{'o'}") || die "can't open $opts{'o'}";

# first do header
my @t = split('\n', $flm_hdr);
foreach (@t) {
    while(/(_{2,3}[A-Za-z0-9_]+)/) {
        my $tmp = substitute($1);
        s/$1/$tmp/g;
    }
    print OFILE "$_\n";
}

#then auditoriums
for (my $i=0; $i<$opts{"n"}; $i++) {
    @t = split('\n', $flm_auditorium);
    foreach (@t) {
        while(/(_{2,3}[A-Za-z0-9_]+)/) {
            my $tmp = substitute($1);
            s/$1/$tmp/g;
        }
        print OFILE "$_\n";
    }
}

print OFILE $flm_tail;

close(OFILE);
