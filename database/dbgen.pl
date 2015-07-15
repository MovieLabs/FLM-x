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
# PERL script to insert FLM instance document into a MariaDB table
# The IssueDate and FacilityID values are extracted from the instance
#
# Usage: dbgen.pl [-o output file] [-e] <flm-instance-file(s)>
# where
# -o output file (if omitted uses mktemp) to generate a file
# -e execute generated SQL
#

use POSIX;
use Getopt::Std;
my %subs;
my %opts;
my $fname;

getopts("eo:", \%opts);
if ($opts{"o"} eq "") {
    $fname = `mktemp`;
    chomp $fname; 
    $fname .= ".sql";
} else {
    $fname = $opts{"o"};
}
print "opt_e=$opts{'e'}\n";
print "saving output to $fname\n";

open(OFILE, ">$fname") || die "can't open output file $fname";
print OFILE "USE flm;\n";
foreach my $i (@ARGV) {
    my $xml_data = "";
    my $facility_id;
    #my $issue_date;
    
    open(FILE, "<$i") || die "can't open $i";
    while(<FILE>) {
        $xml_data .= $_;
        if (/flm:FacilityID>(.*)<\/flm:FacilityID/) {
            $facility_id = $1;
        }
        # if (/flm:IssueDate>(.*)<\/flm:IssueDate/) {
        #     $issue_date = $1;
        #     $issue_date =~ s/T/ /;
        # }
    }
    close(FILE);
    print OFILE "--XML from $i\n";
    print OFILE "INSERT INTO flm\n";
    print OFILE "    (facility_id, xml_data)\n";
    print OFILE "VALUES\n";
    print OFILE "('$facility_id', \n";
    print OFILE "'$xml_data";
    print OFILE "');\n";

}
close OFILE;
if ($opts{'e'}) {
    print "executing SQL, result= ";
    my $result = `mysql -uflmtest -ppwd < $fname`;
}
print "$result\n";
