I. Introduction

This tarball contains files that support an HTTP(s) server that
implements the proposed FLM exchange protocol described in the SMPTE
ST 430-7 revision.  As the revision is not finalized, this may not
accurately capture the current state of the protocol.  It is accurate
(modulo bugs) as of June, 2015.

Please report any bugs, issues, etc. to pgj@movielabs.com.

II. Installation

The following are prerequisites:

* MariaDB: this is Google's relational database, fully compatible with
  and based on a fork of MySQL.  For this reason, it should be
  possible to use MySQL as an alternative to MariaDB.  This work was
  done with v5.5.41, but the specific version should not matter since
  no advanced features are being used.  The installer can be obtained
  from https://mariadb.org/.

* Node JS: this work was done with v0.12.3. Node is widely available.  Best to
  start at https://nodejs.org/

* npm modules: npm (Node Package Manager) provides a standardized
  method for adding functionality to Node JS.  The 'npm' command line
  tool should be installed automatically by the Node JS installer.
  The following npm modules are required.  See https://www.npmjs.com/
  for more information on npm.  The shell script 'npm-install.sh' will
  invoke the appropriate commands in any Unix-flavored environment:

     * underscore
     * colors
     * optimist
     * ls
     * libxml-xsd
     * libxmljs
     * mariasql
     * connect
     * express
     * sprintf-js

* Other: some of the included scripts are based on PERL and the Bourne
  Shell.  Several of the npm modules require g++/gcc to compile native
  code.  This work was done on an x86 computer running CentOS 7
  (7.0.1406).  In addition, the following Unix utilities may need to
  be installed: nmap, openssl, base64, curl.

III. Unpacking the tarball

After the pre-requisite software is installed, the tarball should be
unpacked into the directory specified in the Node JS install (which
will contain the 'node_modules' sub-directory.  The listing should look
somewhat like this:

   README.txt  flm-srv.js	node_modules/	  xsd/
   auth/       npm-install.sh*  test-proto.sh*
   database/   namespace	pwd-gen.js

Be sure to run npm-install.sh after unpacking the tarball if it has
not been done yet.

IV. Database Seeding

Files pertaining to the database may be found in the 'database'
sub-directory.  On a freshly-installed MariaDB/MySQL system the
following scripts can be used.  These may may need to be tweaked on an
existing system.  The scripts and order of execution are as follows:

* newuser.sql: First this creates a database named 'flm'.  Next, this
  creates a user 'flmtest' with password 'pwd' and grants appropriate
  privileges.  It needs to be invoked as SQL root.  Subsequent SQL
  commands should be invoked as the 'flmtest' user.  Note: several of
  the scripts contain hard-coded references to user 'flmtest' and
  password 'pwd'.  You will need to edit accordingly if you elect to
  use something else.

* flmtable.sql: this creates a table named 'flm' which stores FLM data
  used by the FLM Exchange Protocol server.  It may be invoked with the
  command 'mysql -uflmtest -ppwd < flmtable.sql'.  The schema for the
  flm table is very simple.  Each row represents a Facility,
  comprising three columns:

    * facility_id (PK): the Facility ID

    * modified: the last time facility data was modified

    * xml_data: an XML document conforming to the ST 430-7 schema that
      represents the facility.  (Note: in a production scenario the
      schema would likely be more complex, with multiple tables for
      FLM data.  Alternatively a document store like Mongo could be
      used to store a JSON representation of FLM data.  This is beyond
      the scope of this exercise.)

* regen.sh: this shell script populates the database with synthetic
  data.  This is done by invoking the 'flmgen.pl' script with f1.txt,
  f2.txt, f3.txt, and f4.txt, respectively.  Each of these files
  contains variables that are substituted into a template file and
  output to a corresponding f?.xml file.  The generated XML documents
  contain 2, 20, 6, and 30 auditoriums, respectively.

* flmgen.pl: this PERL script takes as input files (e.g. f?.txt)
  containing sets of variables (prefixed with either '__' or '___')
  and uses them to apply substitutions to a template file
  ('TEMPLATE.xml' by default); the output is written to a new file
  corresponding to each input file.  By convention, the input files
  are .txt and the output files are .xml.

* dbgen.pl: this PERL script takes FLM XML files (e.g. those produced
  by running flmgen.pl), and generates SQL statements to insert them
  into the database.

For the flm server, the only pre-requisite is for there to be a
database named 'flm' that contains a table named 'flm' with the schema
as described above.  Pre-populating the database makes it easier to
get started testing the protocol (in particular, to run the included
verification script).  For the very first time, the following sequence
may be performed in a command shell:

   % mysql -uroot < newuser.sql # -p not required if no root password
   % mysql -uflmuser -ppwd < flmtable.sh # create FLM table
   % regen.sh  # generate 4 facilities (f1.xml, f2.xml, f3.xml, f4.xml)
   % dbgen.pl f[1234].xml # add FLM XML docs to database

Note that SQL 'root' is orthogonal to Unix 'root'.  None of these
commands need (or should) be run as superuser.

V. Running the server

The basic command to start the server (by opening a command window and
changing the working directory to the Node JS installation directory)
is as follows:

   % node flm-srv.js [--auth basic] [--tls]

There are two optional arguments:

      --auth basic: if specified, the server expects an Authorization
        header containing a base64-encoded user:pwd tuple per the HTTP
        RFC.  The request will generate an error if either the header
        is missing or the tuple is invalid.  See also below the
        section on password management.  If omitted, authentication is
        not required.

      --tls: if specified, a listener will be created on port BASE+1
        where BASE is the HTTP listener port.  This port will accept
        HTTPS connections to the server.  See also below the section
        on certificates. If omitted, only the HTTP port is listened
        on.

By default the server will listen on port 3000 for HTTP connections,
and (optionally) port 3001 for HTTPS connections.  The default can be
changed by modifying the 'http_port' constant in flm-srv.js.  The
server can be exited by enterng a CTRL-C (^C) into the terminal window
in which node was invoked.

VI. Password Management

The FLM server uses a rudimentary scheme for basic authentication,
with the relevant files contained in the 'auth' subdirectory:

    * passwd: contains username/password tuples, delimited by a colon
      ':'.  Accordingly, neither username nor password should contain
      a colon.

    * passwd.hash.  contains username/hashed-password tuples,
      delimited by a colon.  This file is read by the flm-srv.js Node
      script.  It is generated by the pwd-gen.js node script.  To
      generate this file, use the following procedure:

        1) edit passwd file to suit

        2) While the server is not running, execute the command 'node
           pwd-gen.js auth/passwd > auth/passwd.hash'.  This script
           will read the password file, and write the corresponding
           hash password data to standard output.

    * user1.txt: this is an example of how to generate a
      base64-encoded username/password tuple (there are other ways).
      The first step is to create a file containing a tuple
      representing a user.  It is important that the file be created
      without a trailing newline (some editors make this hard; 'echo
      -n foo:bar > foo.txt' is an alternative).  In the example, the
      user is 'user1' and the password is 'Terpsichord'.  On Unix
      systems the lack of newline can be verified with the command 'od
      -c user1.txt'.

    * user1.b64: this is the base64-encoded data that can be placed in
      an 'Authorization' HTTP header.  On a Unix system, the command
      would be 'cat user1.txt | base64 > user1.b64' (again taking care
      to ensure the .txt file does not contain a trailing newline).

VII. HTTPS Certs

To generate PEM files for HTTP the 'gen-pem.sh' script can be used.
The script assumes that openssl is installed on the system.  The files
included in the tarball are valid and can be used as-is.  If new PEM
files are generated, they must be named key.pem and cert.pem, and be
located in the 'auth' sub-directory.

VIII. Installation Verification

To verify a good basic installation, perform the following procedure:

  1) Install software as described in Section II.

  2) Unpack tarball into Node JS install directory as described in
     Section III.

  3) Start MariaDB and populate it with sample data as described in
     Section IV.  Verify by manually inspecting the flm.flm table, e.g.:

      % mysql -uflmtest -ppwd
      Welcome to the MariaDB monitor.  Commands end with ; or \g.
      Your MariaDB connection id is 5
      Server version: 5.5.41-MariaDB MariaDB Server
      
      Copyright (c) 2000, 2014, Oracle, MariaDB Corporation Ab and others.
      
      Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.
      
      MariaDB [(none)]> use flm;
      Reading table information for completion of table and column names
      You can turn off this feature to get a quicker startup with -A
      
      Database changed
      MariaDB [flm]> select facility_id, modified from flm;
      +-------------+---------------------+
      | facility_id | modified            |
      +-------------+---------------------+
      | xyz:123456  | 2015-06-15 23:14:44 |
      | xyz:51138   | 2015-06-15 23:14:44 |
      | xyz:583054  | 2015-06-16 00:38:01 |
      | xyz:773054  | 2015-06-15 23:14:44 |
      +-------------+---------------------+
      5 rows in set (0.00 sec)

  4) open a command window, cd to the Node directory and start the FLM
     server (you do not need to be root): 

     % node flm-srv.js --auth basic --tls

  5) open a second command window, cd to Node directory and verify
     ports 3000/3001 are open using 'nmap' utility (you may need to
     install this):

     % nmap localhost

     Starting Nmap 6.40 ( http://nmap.org ) at 2015-06-25 16:39 PDT
     Nmap scan report for localhost (127.0.0.1)
     Host is up (0.00028s latency).
     Other addresses for localhost (not scanned): 127.0.0.1
     Not shown: 993 closed ports
     PORT     STATE SERVICE
     22/tcp   open  ssh
     25/tcp   open  smtp
     111/tcp  open  rpcbind
     631/tcp  open  ipp
     3000/tcp open  ppp
     3001/tcp open  nessus
     3306/tcp open  mysql

  6) execute the test-proto.sh script (requires 'curl' utility, you
     may need to install this):

     % ./test-proto.sh

     In this window output should be HTTP response data.  In the other
     window, the Node server will print some diagnostic info that
     looks like this:

     Auth=basic; https=true
     Request received from ::1: GET, /
     isAuthorized=true
     req_GetFacList
     Completed successfully
     Done with all results
     dbclient closed without error
     Request received from ::1: GET, /xyz:123456
     isAuthorized=true
     req_GetFac
     Completed successfully
     Done with all results
     dbclient closed without error
     Request received from ::1: DELETE, /xyz:583054
     isAuthorized=true
     req_Delete
     Completed successfully; replaced=1
     Done with all results
     dbclient closed without error
     Request received from ::ffff:192.168.1.164: POST, /
     isAuthorized=true
     raw=283383
     req_AddUpdate
     Completed successfully; replaced=1
     Done with all results
     dbclient closed without error
